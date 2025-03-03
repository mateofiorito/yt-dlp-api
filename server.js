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
 * Downloads the merged video (video + audio) in the best quality possible and returns the file.
 */
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Define a fixed output file path (using a unique filename if desired)
  const outputFilePath = path.join(downloadsDir, `output-${Date.now()}.mp4`);

  // Build the yt-dlp command to download the best video and audio streams, merge them, and output as mp4.
  const command = `${ytDlpPath} --no-check-certificate -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "${outputFilePath}" "${url}"`;
  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`yt-dlp output: ${stdout}`);
    // Optionally log the directory contents for debugging
    console.log('Downloads folder contents:', fs.readdirSync(downloadsDir));

    // Send the file after a short delay (adjust if necessary)
    setTimeout(() => {
      if (!fs.existsSync(outputFilePath)) {
        console.error('File does not exist at path:', outputFilePath);
        console.log('Downloads folder contents:', fs.readdirSync(downloadsDir));
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
        }
      });
    }, 5000);
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

  const outputFilePath = path.join(downloadsDir, `audio-${Date.now()}.mp3`);

  // Build the command to extract audio and convert to MP3
  const command = `${ytDlpPath} --no-check-certificate -x --audio-format mp3 -o "${outputFilePath}" "${url}"`;
  console.log(`Executing /download-audio command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp (audio): ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
    console.log(`yt-dlp (audio) output: ${stdout}`);

    setTimeout(() => {
      if (!fs.existsSync(outputFilePath)) {
        console.error('Audio file not found at:', outputFilePath);
        return res.status(500).json({ error: 'Downloaded audio file not found.' });
      }
      res.sendFile(outputFilePath, (err) => {
        if (err) {
          console.error('Error sending audio file:', err);
          return res.status(500).json({ error: 'Error sending audio file.' });
        } else {
          console.log('Audio file sent successfully.');
        }
      });
    }, 5000);
  });
});

/**
 * POST /download-video-only
 * Expects a JSON body: { "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
 * Downloads just the video (without audio) in high quality and returns the video file.
 */
app.post('/download-video-only', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  const outputFilePath = path.join(downloadsDir, `video-${Date.now()}.mp4`);

  // Build the command to download only the video stream.
  // Use "-f bestvideo" with a filter for MP4 (if available).
  const command = `${ytDlpPath} --no-check-certificate -f "bestvideo[ext=mp4]" -o "${outputFilePath}" "${url}"`;
  console.log(`Executing /download-video-only command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp (video-only): ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
    console.log(`yt-dlp (video-only) output: ${stdout}`);

    setTimeout(() => {
      if (!fs.existsSync(outputFilePath)) {
        console.error('Video-only file not found at:', outputFilePath);
        return res.status(500).json({ error: 'Downloaded video-only file not found.' });
      }
      res.sendFile(outputFilePath, (err) => {
        if (err) {
          console.error('Error sending video-only file:', err);
          return res.status(500).json({ error: 'Error sending video-only file.' });
        } else {
          console.log('Video-only file sent successfully.');
        }
      });
    }, 5000);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
