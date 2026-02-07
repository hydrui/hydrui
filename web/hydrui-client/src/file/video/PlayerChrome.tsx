import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/solid";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { StreamFile } from "./StreamFile";
import "./index.css";

interface PlayerChrome {
  player: HTMLVideoElement;
}

const formatTime = (time: number) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const PlayerChrome: React.FC<PlayerChrome> = ({ player }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const seekingTime = useRef(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const played = duration > 0 ? currentTime / duration : 0;

  // Idle timer for player controls
  const idleTimer = useRef<number | null>(null);
  const resetIdleTimer = useCallback(() => {
    setShowControls(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);

    idleTimer.current = window.setTimeout(() => {
      // Only hide if the video is actually playing
      if (!player.paused) {
        setShowControls(false);
      }
      idleTimer.current = null;
    }, 3000);
  }, [player]);
  const hideControlsSoon = useCallback(() => {
    if (showControls === false) {
      return;
    }
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      // Only hide if the video is actually playing
      if (!player.paused) {
        setShowControls(false);
      }
      idleTimer.current = null;
    }, 500);
  }, [player, showControls]);

  // Player control logic
  const togglePlay = useCallback(
    () => (player.paused ? player.play() : player.pause()),
    [player],
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setIsLoading(true);
    seekingTime.current = time;
    setCurrentTime(time);
    player.fastSeek(time);
    Promise.resolve().then(() => player.fastSeek(time));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    player.volume = val;
    player.muted = val === 0;
  };

  // Event handlers
  useEffect(() => {
    if (!player) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onPlaying = () => setIsLoading(false);
    const onWaiting = () => setIsLoading(true);
    const onTimeUpdate = () => {
      if (player.currentTime >= 0) {
        if (isPlaying && player.currentTime == seekingTime.current) {
          // Still loading.
          setIsLoading(true);
        } else {
          setIsLoading(false);
        }
        setCurrentTime(player.currentTime);
      }
      // Calculate buffered percentage
      if (player.buffered && player.buffered.length > 0) {
        setBuffered(
          player.buffered.end(player.buffered.length - 1) / player.duration,
        );
      }
    };
    const onDurationChange = () => setDuration(player.duration);
    const onVolumeChange = () => {
      setVolume(player.volume);
      setIsMuted(player.muted);
    };

    const onClick = () => {
      if (idleTimer.current === null && !player.paused) {
        resetIdleTimer();
      } else {
        togglePlay();
      }
    };

    const onDoubleClick = () => {
      toggleFullscreen();
    };

    const onBufferChanged = (buffered: number) => {
      setBuffered(buffered);
    };

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("playing", onPlaying);
    player.addEventListener("waiting", onWaiting);
    player.addEventListener("timeupdate", onTimeUpdate);
    player.addEventListener("durationchange", onDurationChange);
    player.addEventListener("volumechange", onVolumeChange);
    player.addEventListener("click", onClick);
    player.addEventListener("dblclick", onDoubleClick);

    let stream: StreamFile | undefined = undefined;
    if ("_stream" in player && player._stream !== undefined) {
      stream = (player as unknown as { _stream: StreamFile })._stream;
      stream.onBufferChanged = onBufferChanged;
    }

    return () => {
      if (stream) {
        stream.onBufferChanged = undefined;
      }
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("playing", onPlaying);
      player.removeEventListener("waiting", onWaiting);
      player.removeEventListener("timeupdate", onTimeUpdate);
      player.removeEventListener("durationchange", onDurationChange);
      player.removeEventListener("volumechange", onVolumeChange);
      player.removeEventListener("click", onClick);
      player.removeEventListener("dblclick", onDoubleClick);
    };
  }, [isPlaying, player, resetIdleTimer, toggleFullscreen, togglePlay]);

  // Ensure player is inserted into DOM.
  useEffect(() => {
    const playerDiv = playerRef.current;
    if (playerDiv && player) {
      playerDiv.replaceChildren(player);
    }
    return () => {
      if (playerDiv && player) {
        playerDiv.removeChild(player);
      }
    };
  }, [player]);

  return (
    <div
      ref={containerRef}
      className={`player-chrome ${!showControls ? "player-chrome-hide-cursor" : ""}`}
      onPointerMove={resetIdleTimer}
      onPointerUp={resetIdleTimer}
      onMouseOut={hideControlsSoon}
    >
      <div className="player-chrome-player" ref={playerRef} />

      {/* Loading Overlay */}
      <div
        className={`player-chrome-loading-overlay ${isLoading ? "visible" : "hidden"}`}
      ></div>

      {/* Controls Overlay */}
      <div
        className={`player-chrome-controls-overlay ${showControls || !isPlaying ? "visible" : "hidden"}`}
      >
        <div className="player-chrome-controls-gradient" />

        <div className="player-chrome-controls-content">
          {/* Progress Bar */}
          <div className="player-chrome-seek-container">
            <div
              className="player-chrome-progress-buffer"
              style={{ width: `${buffered * 100}%` }}
            />
            <div
              className="player-chrome-progress-playback"
              style={{ width: `${played * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="any"
              value={currentTime}
              onChange={handleSeek}
              className="player-chrome-seek-bar"
            />
          </div>

          <div className="player-chrome-bottom-bar">
            <div className="player-chrome-left-group">
              <button
                onClick={togglePlay}
                className="player-chrome-control-btn"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <div className="player-chrome-volume-group">
                <button
                  onClick={() => (player.muted = !isMuted)}
                  className="player-chrome-control-btn"
                >
                  {isMuted || volume === 0 ? (
                    <SpeakerXMarkIcon />
                  ) : (
                    <SpeakerWaveIcon />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  className="player-chrome-volume-slider"
                />
              </div>

              <span className="player-chrome-time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="player-chrome-control-btn"
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon />
              ) : (
                <ArrowsPointingOutIcon />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
