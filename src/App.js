import "./App.css";
import React, { useEffect, useRef } from "react";
import * as Ably from "ably/promises";
import { ChakraProvider } from "@chakra-ui/react";
import { API_URL, genRandomID } from "./utils";
import MapCanvas from "./canvas/MapCanvas";
import { IconButton, Button } from "@chakra-ui/react";
import { PlusSquareIcon } from "@chakra-ui/icons";
import {
  FaMountain,
  FaWater,
  FaCity,
  FaTree,
  FaSnowflake,
  FaKeyboard,
  FaPlus,
  FaMinus,
} from "react-icons/fa";

function App() {
  const ablyRef = useRef(null);
  const channelRef = useRef(null);
  const gotIndex = useRef(false);

  useEffect(() => {
    const clientId = genRandomID();
    ablyRef.current = new Ably.Realtime.Promise({
      authUrl: `${API_URL}/api/token-request?clientId=${clientId}`,
    });
    channelRef.current = ablyRef.current.channels.get(`channel:global`);
    channelRef.current.subscribe("tilesUpdated", ({ data }) => {
      window.onUpdateTiles(data.tiles, data.id);
    });
    channelRef.current.subscribe("tilesIndex", ({ data }) => {
      if (gotIndex.current) return;
      window.onUpdateTiles(data.tiles, null);
      gotIndex.current = true;
    });
    channelRef.current.publish("indexTiles", {});
  }, []);

  const renderTile = (location, caption, id) => {
    channelRef.current.publish("renderTile", { ...location, caption, id });
  };

  return (
    <ChakraProvider>
      <div className="App">
        <div style={{ position: "absolute", zIndex: 99 }}>
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
          <IconButton
            colorScheme="teal"
            size="lg"
            icon={<FaMountain />}
            m={2}
            onClick={() =>
              window.onGenerate("a satellite image of a mountain range")
            }
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            m={2}
            icon={<FaWater />}
            onClick={() =>
              window.onGenerate("a satellite image of a body of water")
            }
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            m={2}
            icon={<FaCity />}
            onClick={() => window.onGenerate("a satellite image of a city")}
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            m={2}
            icon={<FaTree />}
            onClick={() => window.onGenerate("a satellite image of a forest")}
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            m={2}
            icon={<FaSnowflake />}
            onClick={() =>
              window.onGenerate("a satellite image of a snowy landscape")
            }
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            m={2}
            icon={<FaKeyboard />}
            onClick={() =>
              window.onGenerate(
                "a satellite image of a " + prompt("a satellite image of a...")
              )
            }
          />
        </div>
        <div style={{ position: "absolute", zIndex: 99, right: 0 }}>
          <IconButton
            colorScheme="whiteAlpha"
            size="lg"
            icon={<FaMinus />}
            m={2}
            onClick={() => window.zoom(-1)}
          />
          <IconButton
            colorScheme="whiteAlpha"
            size="lg"
            m={2}
            icon={<FaPlus />}
            onClick={() => window.zoom(1)}
          />
        </div>
        <MapCanvas renderTile={renderTile} />
      </div>
    </ChakraProvider>
  );
}

export default App;
