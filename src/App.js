import "./App.css";
import React, { useEffect, useRef } from "react";
import * as Ably from "ably/promises";
import { ChakraProvider } from "@chakra-ui/react";
import { API_URL } from "./utils";
import MapCanvas from "./canvas/MapCanvas";
import { IconButton } from "@chakra-ui/react";
import { PlusSquareIcon } from "@chakra-ui/icons";

const genRandomID = () => {
  const vocab = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (var i = 0; i < 6; i++) {
    result += vocab.charAt(Math.floor(Math.random() * vocab.length));
  }
  return result;
};

function App() {
  const ablyRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    const clientId = genRandomID();
    ablyRef.current = new Ably.Realtime.Promise({
      authUrl: `${API_URL}/api/token-request?clientId=${clientId}`,
    });
    channelRef.current = ablyRef.current.channels.get(`channel:global`);
    channelRef.current.subscribe("tilesUpdated", ({ data }) => {
      window.onUpdateTiles(data.tiles);
    });
  }, []);

  const renderTile = (args) => {
    channelRef.current.publish("renderTile", args);
  };

  return (
    <ChakraProvider>
      <div className="App">
        <div style={{ position: "absolute", zIndex: 99 }}>
          <IconButton
            colorScheme="teal"
            size="lg"
            icon={<PlusSquareIcon />}
            onClick={() => window.onGenerate()}
          />
        </div>
        <MapCanvas renderTile={renderTile} />
      </div>
    </ChakraProvider>
  );
}

export default App;
