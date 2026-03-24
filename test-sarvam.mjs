import https from 'https';

const req = https.request('https://api.sarvam.ai/speech-to-text-translate', {
  method: 'POST',
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Data:', data.slice(0, 100));
  });
});
req.on('error', console.error);
req.end();
