const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Define yt-dlp command path (assumes yt-dlp is in your PATH)
const ytDlpPath = 'yt-dlp';

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
 * Downloads the merged video (video+audio) and returns it.
 */
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Define a fixed output file path for the merged video.
  const outputFilePath = path.join(downloadsDir, 'output.mp4');

  // Use a simple format that downloads a pre-merged file.
  const command = `yt-dlp --no-check-certificate -f best -o "${outputFilePath}" "${url}"`;
  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing yt-dlp: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`yt-dlp output: ${stdout}`);
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
 * POST /download-both
 * Expects a JSON body: { "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
 * Downloads:
 *   - The merged video (video+audio) in MP4 format (using ffmpeg merging)
 *   - The audio-only version (converted to MP3)
 * Returns both files in a single multipart/mixed HTTP response.
 */
app.post('/download-both', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Generate a unique base name using a timestamp.
  const baseName = `output-${Date.now()}`;
  const mergedFilePath = path.join(downloadsDir, `${baseName}-merged.mp4`);
  const audioFilePath = path.join(downloadsDir, `${baseName}-audio.mp3`);

  // Command to download the merged video (video+audio) using merging.
  const mergedCommand = `${ytDlpPath} --no-check-certificate -f "bestvideo[height<=1080][fps<=60]+bestaudio/best" --merge-output-format mp4 -o '${mergedFilePath}' "${url}"`;
  // Command to extract audio only (converted to MP3).
  const audioCommand = `${ytDlpPath} --no-check-certificate -x --audio-format mp3 -o '${audioFilePath}' "${url}"`;

  console.log(`Executing merged command: ${mergedCommand}`);
  exec(mergedCommand, (errorMerged, stdoutMerged, stderrMerged) => {
    if (errorMerged) {
      console.error(`Error executing merged command: ${errorMerged.message}`);
      return res.status(500).json({ error: errorMerged.message });
    }
    console.log(`Merged output: ${stdoutMerged}`);

    console.log(`Executing audio command: ${audioCommand}`);
    exec(audioCommand, (errorAudio, stdoutAudio, stderrAudio) => {
      if (errorAudio) {
        console.error(`Error executing audio command: ${errorAudio.message}`);
        return res.status(500).json({ error: errorAudio.message });
      }
      console.log(`Audio output: ${stdoutAudio}`);

      // Increase delay to ensure both files are written (adjust as needed)
      setTimeout(() => {
        if (!fs.existsSync(mergedFilePath) || !fs.existsSync(audioFilePath)) {
          console.error('One or both files not found.');
          console.log('Downloads folder contents:', fs.readdirSync(downloadsDir));
          return res.status(500).json({ error: 'One or both downloaded files not found.' });
        }
        
        // Read both files into buffers.
        const mergedBuffer = fs.readFileSync(mergedFilePath);
        const audioBuffer = fs.readFileSync(audioFilePath);
        
        // Build a multipart/mixed response.
        const boundary = '---MYBOUNDARY';
        res.setHeader('Content-Type', 'multipart/mixed; boundary=' + boundary);
        
        const parts = [];
        // Part 1: Merged video file.
        parts.push(Buffer.from(`--${boundary}\r\nContent-Type: video/mp4\r\nContent-Disposition: attachment; filename="merged.mp4"\r\n\r\n`));
        parts.push(mergedBuffer);
        // Part 2: Audio file.
        parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Type: audio/mpeg\r\nContent-Disposition: attachment; filename="audio.mp3"\r\n\r\n`));
        parts.push(audioBuffer);
        // End boundary.
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
        
        const responseBuffer = Buffer.concat(parts);
        res.end(responseBuffer);
      }, 5000); // 5-second delay; adjust if necessary.
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

