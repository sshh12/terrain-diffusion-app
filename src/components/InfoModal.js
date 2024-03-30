import React, { useState } from "react";
import SweetAlert2 from "react-sweetalert2";

function InfoModal({ forceOpen, setForceOpen }) {
  let [open, setOpen] = useState(!localStorage.getItem("infomodal:closed"));
  let alert = {};
  if (open || forceOpen) {
    alert = {
      show: true,
      title: "Terrain Diffusion",
      confirmButtonText: "Explore",
      html: `
      The following map is completely AI-generated based on Stable Diffusion finetuned on actual satellite imagery. 
      To generate more parts of the map, <b>place the white square over the edge of an existing region</b> (or in a completely blank space) and <b>click one of the generation buttons at the top</b>. 
      This is a live colaborative map so other users edits will automatically appear. 
      <br/><br/>If you want to learn more see this <b><a href="https://blog.sshh.io/p/terrain-diffusion">blog post</a><b>.
      <br/><br/><img src="https://i.imgur.com/scomL5Y.png" />`,
    };
  }
  return (
    <div>
      <SweetAlert2
        key={forceOpen}
        {...alert}
        onConfirm={() => {
          setOpen(false);
          setForceOpen(false);
          localStorage.setItem("infomodal:closed", true);
        }}
      ></SweetAlert2>
    </div>
  );
}

export default InfoModal;
