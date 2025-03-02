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
 * Downloads the merged video (video+audio) and returns the video file.
 */
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Define a fixed output file path
  const outputFilePath = path.join(__dirname, 'downloads', 'output.mp4');

  // Build the yt-dlp command using -f best (pre-merged)
  const command = `${ytDlpPath} --no-check-certificate -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "${outputFilePath}" "${url}"`;
  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`yt-dlp output: ${stdout}`);

    // After the download is complete, send the file back in the response.
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

/**
 * POST /download-audio
 * Expects a JSON body: { "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
 * Downloads just the audio, converts it to MP3, and returns the MP3 file.
 */
app.post('/download-audio', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Generate a unique filename for the audio file using a timestamp
  const fileName = `audio-${Date.now()}.mp3`;
  const outputFilePath = path.join(__dirname, 'downloads', fileName);

  // Build the yt-dlp command for audio extraction
  // -x: extract audio
  // --audio-format mp3: convert to mp3
  const command = `${ytDlpPath} --no-check-certificate -x --audio-format mp3 -o "${outputFilePath}" "${url}"`;
  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`yt-dlp output: ${stdout}`);

    // Wait a short period to ensure the file is written
    setTimeout(() => {
      if (!fs.existsSync(outputFilePath)) {
        console.error('File does not exist at path:', outputFilePath);
        return res.status(500).json({ error: 'Downloaded audio file not found.' });
      }
      // Send the MP3 file in the response
      res.sendFile(outputFilePath, (err) => {
        if (err) {
          console.error('Error sending audio file:', err);
          res.status(500).json({ error: 'Error sending audio file.' });
        } else {
          console.log('Audio file sent successfully.');
        }
      });
    }, 5000); // 5-second delay; adjust as needed.
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

