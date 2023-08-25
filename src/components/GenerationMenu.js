import React from "react";
import { IconButton, Button } from "@chakra-ui/react";
import { PlusSquareIcon } from "@chakra-ui/icons";
import { Tooltip } from "@chakra-ui/react";
import {
  FaMountain,
  FaWater,
  FaCity,
  FaTree,
  FaSnowflake,
  FaKeyboard,
  FaTemperatureHigh,
} from "react-icons/fa";

const options = [
  { prompt: "a satellite image of a mountain range", icon: FaMountain },
  { prompt: "a satellite image of a body of water", icon: FaWater },
  { prompt: "a satellite image of a city", icon: FaCity },
  { prompt: "a satellite image of a forest", icon: FaTree },
  { prompt: "a satellite image of a desert", icon: FaTemperatureHigh },
  { prompt: "a satellite image of a snowy landscape", icon: FaSnowflake },
];

function GenerationMenu({ isLoading }) {
  return (
    <div style={{ position: "absolute", zIndex: 99 }}>
      {isLoading && (
        <Button colorScheme="green" variant="solid" size="lg" m={2}>
          Loading... if this takes more than a couple seconds, try again later.
        </Button>
      )}
      {!isLoading && (
        <>
          <Tooltip label={`Generate: "a satellite image"`}>
            <Button
              leftIcon={<PlusSquareIcon />}
              colorScheme="green"
              variant="solid"
              size="lg"
              m={2}
              onClick={() => window.onGenerate("a satellite image")}
            >
              Generate
            </Button>
          </Tooltip>
          {options.map((opt) => {
            return (
              <Tooltip key={opt.prompt} label={`Generate: "${opt.prompt}"`}>
                <IconButton
                  colorScheme="teal"
                  size="lg"
                  m={2}
                  icon={<opt.icon />}
                  onClick={() => window.onGenerate(opt.prompt)}
                />
              </Tooltip>
            );
          })}
          <Tooltip label={`Generate a custom landscape`}>
            <IconButton
              colorScheme="teal"
              size="lg"
              m={2}
              icon={<FaKeyboard />}
              onClick={() => {
                const val = prompt("a satellite image of a...");
                if (val) {
                  window.onGenerate("a satellite image of a " + val);
                }
              }}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}

export default GenerationMenu;
