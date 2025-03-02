const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');

// Define yt-dlp command path. Assumes 'yt-dlp' is in your PATH.
const ytDlpPath = 'yt-dlp';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

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

  // Define a fixed output file path. This is where yt-dlp will save the video.
  const outputFilePath = path.join(__dirname, 'downloads', 'output.mp4');

  // Build the yt-dlp command using the fixed output file name.
  // This command tells yt-dlp to download and merge the best video and audio.
  const command = `${ytDlpPath} --no-check-certificate -f "bestvideo+bestaudio/best" -o "${outputFilePath}" "${url}"`;

  console.log(`Executing command: ${command}`);

  // Execute the command and wait for completion.
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`yt-dlp output: ${stdout}`);

    // After the download is complete, send the file back in the response.
    // res.sendFile streams the file to the client.
    res.sendFile(outputFilePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ error: 'Error sending file.' });
      } else {
        console.log('File sent successfully.');
      }
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
