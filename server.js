const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Define yt-dlp command path (assumes yt-dlp is in your PATH)
const ytDlpPath = 'yt-dlp';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Ensure the downloads folder exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Simple test endpoint
app.get('/', (req, res) => {
  res.send('Server is running!');
});

/**
 * POST /download
 * Expects a JSON body: { "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
 * Downloads the video using yt-dlp and then returns the video file.
 */
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Generate a unique output filename to avoid overwrites.
  // This file will be used to store the merged video.
  const fileName = `output-${Date.now()}.mp4`;
  const outputFilePath = path.join(downloadsDir, fileName);

  // Build the yt-dlp command:
  // --no-check-certificate: bypass SSL verification if necessary.
  // -f "bestvideo[height<=1080][fps<=60]+bestaudio/best": select the best video up to 1080p60 plus best audio.
  // --merge-output-format mp4: force merging into an MP4 file.
  // -o '<outputFilePath>': set the output file path.
  const command = `${ytDlpPath} --no-check-certificate -f "bestvideo[height<=1080][fps<=60]+bestaudio/best" --merge-output-format mp4 -o '${outputFilePath}' "${url}"`;
  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`yt-dlp output: ${stdout}`);
    const downloadsFolder = path.join(__dirname, 'downloads');
    console.log('Downloads folder contents after exec:', fs.readdirSync(downloadsFolder));

    // Delay to ensure the file is completely written; adjust delay as needed.
    setTimeout(() => {
      if (!fs.existsSync(outputFilePath)) {
        console.error('File does not exist at path:', outputFilePath);
        console.log('Downloads folder contents:', fs.readdirSync(downloadsFolder));
        return res.status(500).json({ error: 'Downloaded file not found.' });
      }
      res.sendFile(outputFilePath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          return res.status(500).json({ error: 'Error sending file.' });
        } else {
          console.log('File sent successfully.');
        }
      });
    }, 5000); // 5-second delay
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
