from typing import Dict
import json
import modal
from pydantic import BaseModel
from fastapi import Response
from modal_base import (
    image_base,
    image_render,
    app,
    BASE_MODEL,
    INPAINT_LORA,
    CACHE_DIR,
)

import methods
import streaming


class BackendArgs(BaseModel):
    func: str
    args: Dict


@app.function(
    secrets=[
        modal.Secret.from_name("default-aws-secret"),
        modal.Secret.from_name("terrain-diffusion-secret"),
    ],
    image=image_base,
    container_idle_timeout=300,
)
@modal.web_endpoint(method="POST")
async def backend(args: BackendArgs):

    ably = streaming.AblyClient()

    result = await methods.METHODS[args.func](ably, **args.args)

    await ably.disconnect()

    return Response(content=json.dumps(result), media_type="application/json")


def _image_to_bytes(image):
    import io

    byte_stream = io.BytesIO()
    image.save(byte_stream, format="PNG")
    image_bytes = byte_stream.getvalue()
    return image_bytes


@app.cls(
    gpu=modal.gpu.A10G(),
    container_idle_timeout=60,
    image=image_render,
)
class Model:
    @modal.enter()
    def setup(self):
        import torch
        from diffusers import StableDiffusionInpaintPipeline

        self.inpaint_pipe = StableDiffusionInpaintPipeline.from_pretrained(
            BASE_MODEL,
            torch_dtype=torch.float16,
            device_map="auto",
            cache_dir=CACHE_DIR,
        )
        self.inpaint_pipe.unet.load_attn_procs(
            INPAINT_LORA,
            use_safetensors=False,
        )

    @modal.method()
    def inference(self, prompt, image, mask_image, num_inference_steps, guidance_scale):
        from PIL import Image
        import io

        image = self.inpaint_pipe(
            prompt=prompt,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            image=Image.open(io.BytesIO(image)),
            mask_image=Image.open(io.BytesIO(mask_image)),
        ).images[0]

        return _image_to_bytes(image)


@app.function(
    allow_concurrent_inputs=20,
    mounts=[modal.Mount.from_local_python_packages("terrain_rendering", "moderation")],
    secrets=[
        modal.Secret.from_name("default-aws-secret"),
        modal.Secret.from_name("terrain-diffusion-secret"),
    ],
    image=image_render,
)
async def render_tile(x, y, caption, space):
    from terrain_rendering import render_tile
    from PIL import Image
    import aioboto3

    aws = aioboto3.Session()
    modal_model = Model()

    class RemoteInpainter:
        async def run(
            self, prompt, image, mask_image, num_inference_steps, guidance_scale
        ):
            import io

            out_image = await modal_model.inference.remote.aio(
                prompt,
                _image_to_bytes(image),
                _image_to_bytes(mask_image),
                num_inference_steps,
                guidance_scale,
            )
            return Image.open(io.BytesIO(out_image))

    updated_tiles = await render_tile(aws, RemoteInpainter(), x, y, caption, space)
    return updated_tiles
