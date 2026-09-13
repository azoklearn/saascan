const contour = "M300 0C300 120 210 240 60 285C-90 330-240 240-285 90C-330-60-240-225-90-285C60-345 255-165 300 0Z";

const upperContours = ["scale(.5)", "scale(.78) rotate(9)", "scale(1.06) rotate(19)", "scale(1.36) rotate(27)", "scale(1.7) rotate(36)", "scale(2.1) rotate(44)"];
const lowerContours = ["scale(.42) rotate(14)", "scale(.72) rotate(26)", "scale(1.05) rotate(38)", "scale(1.42) rotate(49)", "scale(1.84) rotate(61)"];

export function HeroDecor() {
  return <div className="hero-decor" aria-hidden="true">
    <div className="bath">
      <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 1000" focusable="false">
        <g fill="none" stroke="#00C2A0" strokeWidth="1">
          <g transform="translate(1080 300)" opacity=".16">
            {upperContours.map((transform) => <g key={transform} transform={transform}><path d={contour} /></g>)}
          </g>
          <g transform="translate(180 810)" opacity=".13">
            {lowerContours.map((transform) => <g key={transform} transform={transform}><path d={contour} /></g>)}
          </g>
        </g>
      </svg>
    </div>
    <div className="glow" />
  </div>;
}
