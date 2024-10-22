import path from "path";
import sharp from "sharp";

export async function addTextToImage(
  normalText: string,
  boldText: string
): Promise<Buffer> {
  const inputImagePath = path.join(
    process.cwd(),
    "src/image/simgolf-popup.jpg"
  );
  const svgText = `
    <svg width="700" height="400">
      <text 
        x="350" 
        y="85" 
        text-anchor="middle" 
        font-family="HP Simplified" 
        font-weight="bold"
        font-size="23" 
        fill="#000"
      >${boldText}</text>
      <text 
        x="350" 
        y="150" 
        text-anchor="middle" 
        font-family="HP Simplified" 
        font-weight="normal"
        font-size="17" 
        fill="#000"
      >${normalText}</text>
    </svg>
  `;

  return await sharp(inputImagePath)
    .composite([
      {
        input: Buffer.from(svgText),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}
