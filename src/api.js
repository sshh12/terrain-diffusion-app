const MODAL_ENDPOINT =
  "https://sshh12--terrain-diffusion-app-backend.modal.run/";

export function post(func, args = {}) {
  return fetch(MODAL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      func: func,
      args: args,
    }),
  }).then((response) => response.json());
}
