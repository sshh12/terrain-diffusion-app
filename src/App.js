import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import * as Ably from "ably/promises";
import { ChakraProvider } from "@chakra-ui/react";
import { API_URL, genRandomID } from "./utils";
import MapCanvas from "./canvas/MapCanvas";
import { IconButton, Button } from "@chakra-ui/react";
import GenerationMenu from "./components/GenerationMenu";
import InfoModal from "./components/InfoModal";
import { FaPlus, FaMinus, FaInfo, FaEdit } from "react-icons/fa";

function App() {
  const ablyRef = useRef(null);
  const channelRef = useRef(null);
  const urlSpace =
    new URLSearchParams(window.location.search).get("space") || "global";
  const [helpOpen, setHelpOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [start] = useState(
    JSON.parse(localStorage.getItem("position") || "{}")
  );
  const [pendingGenerations, setPendingGenerations] = useState([]);

  useEffect(() => {
    const clientId = genRandomID();
    ablyRef.current = new Ably.Realtime.Promise({
      authUrl: `${API_URL}/api/token-request?clientId=${clientId}`,
    });
    channelRef.current = ablyRef.current.channels.get(`channel:global`);
    channelRef.current.subscribe("tilesUpdated", ({ data }) => {
      if (data.space !== urlSpace) return;
      window.onUpdateTiles(data.tiles, data.id);
      if (data.id) {
        setPendingGenerations((prev) => prev.filter((id) => id !== data.id));
      }
    });
    fetch(
      `https://terrain-diffusion-app.s3.amazonaws.com/public/tiles/${urlSpace}/index.json`
    )
      .then((resp) => resp.json())
      .then((index) => {
        window.onUpdateTiles(index.tiles);
        setIsLoading(false);
      })
      .catch((e) => {
        if (("" + e).includes("Syntax")) {
          window.onUpdateTiles([]);
          setIsLoading(false);
        } else {
          alert("Error loading tiles");
        }
      });
  }, [urlSpace]);

  const renderTile = (location, caption, id) => {
    channelRef.current.publish("renderTile", {
      ...location,
      caption,
      id,
      space: urlSpace,
    });
  };

  const clearTiles = (location) => {
    // channelRef.current.publish("clearTiles", { ...location });
  };

  const doGenerate = (prompt) => {
    const id = genRandomID();
    window.onGenerate(prompt, id);
    setPendingGenerations((prev) => [...prev, id]);
  };

  return (
    <ChakraProvider>
      <div className="App">
        <InfoModal forceOpen={helpOpen} setForceOpen={setHelpOpen} />
        <GenerationMenu
          isLoading={isLoading}
          doGenerate={doGenerate}
          disabled={pendingGenerations.length > 2}
        />
        <div style={{ position: "absolute", zIndex: 99, right: 0, bottom: 0 }}>
          <Button
            leftIcon={<FaEdit />}
            variant="solid"
            size="lg"
            m={2}
            onClick={() => {
              const newMap =
                prompt("Enter the name of the new/existing world") || "";
              const mapName = newMap
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLocaleLowerCase();
              if (mapName) {
                window.location.href = `/?space=${mapName}`;
              }
            }}
          >
            World: {urlSpace.toUpperCase()}
          </Button>
          <Button
            leftIcon={<FaInfo />}
            colorScheme="blackAlpha"
            variant="solid"
            size="lg"
            m={2}
            onClick={() => setHelpOpen(true)}
          >
            Help
          </Button>
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
        <MapCanvas
          renderTile={renderTile}
          clearTiles={clearTiles}
          space={urlSpace}
          startX={start.x || 0}
          startY={start.y || 0}
          startZoom={start.zoom || 0.5}
        />
      </div>
    </ChakraProvider>
  );
}

export default App;
