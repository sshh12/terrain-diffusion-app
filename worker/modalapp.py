from PIL import Image
import modal

BASE_MODEL = "stabilityai/stable-diffusion-2-inpainting"
INPAINT_LORA = "sshh12/sd2-lora-inpainting-sentinel-2-rgb"
CACHE_DIR = "/root/cache/"


def download_models():
    from huggingface_hub import snapshot_download

    snapshot_download(
        BASE_MODEL,
        ignore_patterns=[
            "*.bin",
            "*.onnx_data",
            "*/diffusion_pytorch_model.safetensors",
        ],
        cache_dir=CACHE_DIR,
    )
    snapshot_download(
        INPAINT_LORA,
        ignore_patterns=["checkpoint-*/*"],
        cache_dir=CACHE_DIR,
    )


image = (
    modal.Image.debian_slim()
    .apt_install(
        "libglib2.0-0", "libsm6", "libxrender1", "libxext6", "ffmpeg", "libgl1"
    )
    .pip_install(
        "diffusers~=0.21",
        "invisible_watermark~=0.1",
        "transformers~=4.31",
        "accelerate~=0.21",
        "safetensors~=0.3",
        "aioboto3~=11.3.0",
        "better-profanity~=0.7",
        "openai~=0.27",
    )
    .run_function(download_models)
)

stub = modal.Stub("terrain-diffusion-app", image=image)


def _image_to_bytes(image):
    import io

    byte_stream = io.BytesIO()
    image.save(byte_stream, format="PNG")
    image_bytes = byte_stream.getvalue()
    return image_bytes


@stub.cls(gpu=modal.gpu.A10G(), container_idle_timeout=60)
class Model:
    def __enter__(self):
        import torch
        from diffusers import StableDiffusionInpaintPipeline
        import torch

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
        import io

        image = self.inpaint_pipe(
            prompt=prompt,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            image=Image.open(io.BytesIO(image)),
            mask_image=Image.open(io.BytesIO(mask_image)),
        ).images[0]

        return _image_to_bytes(image)


@stub.function(
    allow_concurrent_inputs=20,
    mounts=[
        modal.Mount.from_local_python_packages(
            "worker.terrain_rendering", "worker.moderation"
        )
    ],
    secrets=[
        modal.Secret.from_name("openai-secret"),
        modal.Secret.from_name("default-aws-secret"),
    ],
)
async def render_tile(x, y, caption):
    from terrain_rendering import render_tile
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

    updated_tiles = await render_tile(aws, RemoteInpainter(), x, y, caption)
    return updated_tiles


@stub.local_entrypoint()
def main():
    print(render_tile.remote(10, 10, "A satellite image of a mountain"))
