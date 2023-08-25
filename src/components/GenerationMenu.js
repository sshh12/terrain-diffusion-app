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

function GenerationMenu({ isLoading, doGenerate, disabled }) {
  return (
    <div style={{ position: "absolute", zIndex: 99 }}>
      {isLoading && (
        <Button colorScheme="yellow" variant="solid" size="lg" m={2}>
          Loading Map...
        </Button>
      )}
      {disabled && (
        <Button colorScheme="yellow" variant="solid" size="lg" m={2}>
          Wait a few moments...
        </Button>
      )}
      {!isLoading && !disabled && (
        <>
          <Tooltip label={`Generate: "a satellite image"`}>
            <Button
              leftIcon={<PlusSquareIcon />}
              colorScheme="green"
              variant="solid"
              size="lg"
              m={2}
              onClick={() => doGenerate("a satellite image")}
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
                  onClick={() => doGenerate(opt.prompt)}
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
                  doGenerate("a satellite image of a " + val);
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
