# terrain-diffusion-app

> AKA This Map Does Not Exist, is an infinite collaborative inpainter which allows users to dynamic generate satellite-realistic map tiles.

![chrome_2jH8rnJo9C](https://github.com/sshh12/terrain-diffusion-app/assets/6625384/3f339c6a-859e-4b8b-800f-4ff885a62c55)

## How it works

<img width="358" alt="chrome_bx4n7yvh2k" src="https://github.com/sshh12/terrain-diffusion-app/assets/6625384/541fc064-84ab-4e60-8458-839fcf5639c2">

The app is pretty much serverless with [Ably](https://ably.io/) doing most of the live networking and communication between the client and the GPU worker. The GPU worker writes directly to AWS s3 and then notifies the client to re-download them. Netlify is mainly there for static hosting but a cloud function is used to init the Ably websocket.

#### The GPU Worker

The worker listens for generation requests and then:

1. Translates an x, y coordinate into the (up to 4) 512x512 tiles that will need to be modified
2. Download these tiles from s3 (if s3 doesn't have it just generate a blank image)
3. Generate a mask based on any areas that are blank
4. Run this through the stable diffusion inpainting model
5. Update all the tiles and re-upload to s3
6. Broadcast which tiles were updated

### The Canvas

The canvas was written from scratch to support mobile and desktop without too much weirdness. `react-canvas-draw` was used heavily as a reference. It includes minimal optimizations for processing tiles besides lazy loading based on the client's viewport and background image rendering.

## Model

For more information on training the model see https://github.com/sshh12/terrain-diffusion.

## Self-Hosting

At a high level:

1. Create a netlify static app from this repo (or host it yourself `yarn build`, although you'll need replicate the `api/` function)
2. Create an app on https://ably.io/ (free tier works) and set the environment variable `ABLY_API_KEY`
3. On a machine with a GPU run `worker/worker.py`

Feel free to create an issue if you want help setting this up. This app should work fairly seamlessly for any [diffusers](https://huggingface.co/docs/diffusers/index) model.
