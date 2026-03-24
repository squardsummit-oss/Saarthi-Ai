import https from 'https';
const req = https.request('https://api.sarvam.ai/speech-to-text-translate/', {
  method: 'POST',
  headers: {
    'api-subscription-key': 'sk_4ezxhplm_sD81yhKsq9hpoGOVrjH0Iv8O',
    'Content-Type': 'multipart/form-data; boundary=---boundary',
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Data:', data.slice(0, 500));
  });
});
req.write('---boundary\r\nContent-Disposition: form-data; name="file"; filename="test.wav"\r\nContent-Type: audio/wav\r\n\r\n\r\n---boundary--\r\n');
req.end();
