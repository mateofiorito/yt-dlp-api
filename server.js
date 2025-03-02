const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const archiver = require('archiver'); // Used to create ZIP files

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
 * Downloads the merged video (video+audio) and returns it.
 */
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Define a fixed output file path for the merged video.
  const outputFilePath = path.join(downloadsDir, 'output.mp4');

  // Build the yt-dlp command using the "best" format (pre-merged).
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
        return res.status(500).json({ error: 'Error sending file.' });
      } else {
        console.log('File sent successfully.');
      }
    });
  });
});

/**
 * POST /download-both
 * Expects a JSON body: { "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
 * Downloads both:
 *   - The merged video (video+audio) in MP4 format (limited to 1080p60), and
 *   - The audio-only version (converted to MP3).
 * Both files are then packaged into a ZIP archive that is returned to the client.
 */
app.post('/download-both', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  // Generate a unique base filename using a timestamp.
  const baseName = `output-${Date.now()}`;
  const mergedFilePath = path.join(downloadsDir, `${baseName}-merged.mp4`);
  const audioFilePath = path.join(downloadsDir, `${baseName}-audio.mp3`);

  // Command to download merged video+audio (using ffmpeg merging).
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

      // After both downloads complete, create a ZIP archive.
      res.setHeader('Content-Disposition', `attachment; filename=${baseName}.zip`);
      res.setHeader('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 9 }});
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ error: err.message });
      });

      // Pipe the archive stream directly to the response.
      archive.pipe(res);

      // Append the merged video and audio files to the archive.
      archive.file(mergedFilePath, { name: path.basename(mergedFilePath) });
      archive.file(audioFilePath, { name: path.basename(audioFilePath) });

      // Finalize the archive (this returns a promise).
      archive.finalize()
        .then(() => console.log('Archive finalized and sent.'))
        .catch(err => {
          console.error('Archive finalize error:', err);
          res.status(500).json({ error: err.message });
        });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

