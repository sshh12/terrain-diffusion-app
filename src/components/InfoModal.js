import React, { useState } from "react";
import SweetAlert2 from "react-sweetalert2";

function InfoModal({ forceOpen }) {
  let [open, setOpen] = useState(!localStorage.getItem("infomodal:closed"));
  let alert = {};
  if (open || forceOpen) {
    alert = {
      show: true,
      title: "This Map Does Not Exist",
      confirmButtonText: "Explore",
      html: `
      The following map is completely AI-generated based on Stable Diffusion finetuned on actual satellite imagery. 
      To generate more parts of the map, <b>place the white square over the edge of an existing region</b> (or in a completely blank space) and <b>click one of the generation buttons in the top left</b>. 
      This is a live colaborative map so other users edits will automatically appear. 
      If you have feedback or want to learn more see <b><a href="https://github.com/sshh12/terrain-diffusion-app">github.com/sshh12/terrain-diffusion-app</a><b>.
      <hr/><img src="https://i.imgur.com/fpaakOY.png" />`,
    };
  }
  return (
    <div>
      <SweetAlert2
        key={forceOpen}
        {...alert}
        onConfirm={() => {
          setOpen(false);
          localStorage.setItem("infomodal:closed", true);
        }}
      ></SweetAlert2>
    </div>
  );
}

export default InfoModal;
