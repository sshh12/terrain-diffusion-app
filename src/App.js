import "./App.css";
import React, { useEffect, useRef } from "react";
import * as Ably from "ably/promises";
import { ChakraProvider } from "@chakra-ui/react";
import { API_URL, genRandomID } from "./utils";
import MapCanvas from "./canvas/MapCanvas";
import { IconButton } from "@chakra-ui/react";
import { PlusSquareIcon } from "@chakra-ui/icons";
import { FaMountain, FaWater } from "react-icons/fa";

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
          <IconButton
            colorScheme="teal"
            size="lg"
            icon={<PlusSquareIcon />}
            onClick={() => window.onGenerate("a satellite image")}
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            icon={<FaMountain />}
            onClick={() =>
              window.onGenerate("a satellite image of a mountain range")
            }
          />
          <IconButton
            colorScheme="teal"
            size="lg"
            icon={<FaWater />}
            onClick={() =>
              window.onGenerate("a satellite image of a body of water")
            }
          />
        </div>
        <MapCanvas renderTile={renderTile} />
      </div>
    </ChakraProvider>
  );
}

export default App;
