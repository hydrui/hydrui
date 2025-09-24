import React, { useCallback, useState } from "react";

import "./index.css";

interface ColorEditorProps {
  color: string;
  setColor: (color: string) => void;
}

function hexColorToValues(hexColor: string): [number, number, number] {
  const colorParsed = hexColor.match(
    /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
  );
  if (!colorParsed) {
    return [0, 0, 0];
  }
  return [
    parseInt(colorParsed[1], 16),
    parseInt(colorParsed[2], 16),
    parseInt(colorParsed[3], 16),
  ];
}

function valuesToHexColor(color: [number, number, number]): string {
  const redValue = Math.max(Math.min(color[0] | 0, 255), 0);
  const greenValue = Math.max(Math.min(color[1] | 0, 255), 0);
  const blueValue = Math.max(Math.min(color[2] | 0, 255), 0);
  const redHexOctet = redValue.toString(16).padStart(2, "0");
  const greenHexOctet = greenValue.toString(16).padStart(2, "0");
  const blueHexOctet = blueValue.toString(16).padStart(2, "0");
  return `#${redHexOctet}${greenHexOctet}${blueHexOctet}`;
}

function rgbToHsv(rgb: [number, number, number]): [number, number, number] {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const v = max;

  if (delta !== 0) {
    s = delta / max;

    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }

    h = h * 60;
    if (h < 0) {
      h += 360;
    }
  }

  return [Math.round(h), Math.round(s * 100), Math.round(v * 100)];
}

function hsvToRgb(hsv: [number, number, number]): [number, number, number] {
  const h = hsv[0] / 360;
  const s = hsv[1] / 100;
  const v = hsv[2] / 100;

  let r = 0;
  let g = 0;
  let b = 0;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return [
    Math.max(Math.min(Math.round(r * 255), 255), 0),
    Math.max(Math.min(Math.round(g * 255), 255), 0),
    Math.max(Math.min(Math.round(b * 255), 255), 0),
  ];
}

const ColorEditor: React.FC<ColorEditorProps> = ({ color, setColor }) => {
  const [r, g, b] = hexColorToValues(color);
  const [h, s, v] = rgbToHsv([r, g, b]);

  const [colorInput, setColorInput] = useState(color);
  const [redInput, setRedInput] = useState(r);
  const [greenInput, setGreenInput] = useState(g);
  const [blueInput, setBlueInput] = useState(b);
  const [hsvHueInput, setHsvHueInput] = useState(h);
  const [hsvSaturationInput, setHsvSaturationInput] = useState(s);
  const [hsvValueInput, setHsvValueInput] = useState(v);

  const setHsv = useCallback(
    (h: number, s: number, v: number) => {
      const [r, g, b] = hsvToRgb([h, s, v]);
      const color = valuesToHexColor([r, g, b]);
      [h, s, v] = rgbToHsv([r, g, b]);
      setColor(color);
      setColorInput(color);
      setRedInput(r);
      setGreenInput(g);
      setBlueInput(b);
      setHsvHueInput(h);
      setHsvSaturationInput(s);
      setHsvValueInput(v);
    },
    [setColor],
  );

  const setRgb = useCallback(
    (r: number, g: number, b: number) => {
      const color = valuesToHexColor([r, g, b]);
      const [h, s, v] = rgbToHsv([r, g, b]);
      setColor(color);
      setColorInput(color);
      setRedInput(r);
      setGreenInput(g);
      setBlueInput(b);
      setHsvHueInput(h);
      setHsvSaturationInput(s);
      setHsvValueInput(v);
    },
    [setColor],
  );

  return (
    <div className="color-editor">
      <div className="color-editor-row">
        <label htmlFor="hex">Hex</label>
        <div
          className="color-editor-row-colorswatch"
          style={{ backgroundColor: color }}
        ></div>
        <input
          className="color-editor-row-hex-input"
          name="hex"
          type="text"
          value={colorInput}
          onChange={(e) => setColorInput(e.target.value)}
          onBlur={() => setColor(colorInput)}
        ></input>
      </div>
      <div className="color-editor-row">
        <label htmlFor="red">Red</label>
        <input
          className="color-editor-row-component-input"
          name="red"
          type="text"
          value={redInput}
          onChange={(e) => setRedInput(parseInt(e.target.value) || 0)}
          onBlur={() => setRgb(redInput, g, b)}
        ></input>
        <input
          type="range"
          min={0}
          max={255}
          value={r}
          onChange={(e) => setRgb(parseInt(e.target.value) || 0, g, b)}
        ></input>
      </div>
      <div className="color-editor-row">
        <label htmlFor="green">Green</label>
        <input
          className="color-editor-row-component-input"
          name="green"
          type="text"
          value={greenInput}
          onChange={(e) => setGreenInput(parseInt(e.target.value) || 0)}
          onBlur={() => setRgb(r, greenInput, b)}
        ></input>
        <input
          type="range"
          min={0}
          max={255}
          value={g}
          onChange={(e) => setRgb(r, parseInt(e.target.value) || 0, b)}
        ></input>
      </div>
      <div className="color-editor-row">
        <label htmlFor="blue">Blue</label>
        <input
          className="color-editor-row-component-input"
          name="blue"
          type="text"
          value={blueInput}
          onChange={(e) => setBlueInput(parseInt(e.target.value) || 0)}
          onBlur={() => setRgb(r, blueInput, b)}
        ></input>
        <input
          type="range"
          min={0}
          max={255}
          value={b}
          onChange={(e) => setRgb(r, g, parseInt(e.target.value) || 0)}
        ></input>
      </div>
      <div className="color-editor-row">
        <label htmlFor="hue">Hue</label>
        <input
          className="color-editor-row-component-input"
          name="hue"
          type="text"
          value={hsvHueInput}
          onChange={(e) => setHsvHueInput(parseInt(e.target.value) || 0)}
          onBlur={() => setHsv(hsvHueInput, s, v)}
        ></input>
        <input
          type="range"
          min={0}
          max={359}
          value={h}
          onChange={(e) => setHsv(parseInt(e.target.value) || 0, s, v)}
        ></input>
      </div>
      <div className="color-editor-row">
        <label htmlFor="saturation">Saturation</label>
        <input
          className="color-editor-row-component-input"
          name="saturation"
          type="text"
          value={hsvSaturationInput}
          onChange={(e) => setHsvSaturationInput(parseInt(e.target.value) || 0)}
          onBlur={() => setHsv(h, hsvSaturationInput, v)}
        ></input>
        <input
          type="range"
          min={0}
          max={100}
          value={s}
          onChange={(e) => setHsv(h, parseInt(e.target.value) || 0, v)}
        ></input>
      </div>
      <div className="color-editor-row">
        <label htmlFor="value">Value</label>
        <input
          className="color-editor-row-component-input"
          name="value"
          type="text"
          value={hsvValueInput}
          onChange={(e) => setHsvValueInput(parseInt(e.target.value) || 0)}
          onBlur={() => setHsv(h, s, hsvValueInput)}
        ></input>
        <input
          type="range"
          min={0}
          max={100}
          value={v}
          onChange={(e) => setHsv(h, s, parseInt(e.target.value) || 0)}
        ></input>
      </div>
    </div>
  );
};

export default ColorEditor;
