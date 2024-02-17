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
        ],
        cache_dir=CACHE_DIR,
    )
    snapshot_download(
        INPAINT_LORA,
        ignore_patterns=["checkpoint-*/*"],
        cache_dir=CACHE_DIR,
    )


image_render = (
    modal.Image.debian_slim()
    .apt_install(
        "libglib2.0-0", "libsm6", "libxrender1", "libxext6", "ffmpeg", "libgl1"
    )
    .pip_install(
        "diffusers==0.21.2",
        "invisible_watermark~=0.1",
        "transformers~=4.31",
        "accelerate~=0.21",
        "safetensors~=0.3",
        "aioboto3~=11.3.0",
        "better-profanity~=0.7",
        "openai~=0.27",
        "ably==2.0.4",
    )
    .run_function(download_models)
)

image_base = modal.Image.debian_slim().pip_install(
    "ably==2.0.4",
)

stub = modal.Stub("terrain-diffusion-app")
