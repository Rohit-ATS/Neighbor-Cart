# Amazon Bedrock setup

The HarvestLink AI Navigator sends chat messages to `POST /api/v1/ai/chat`. The browser never receives AWS credentials; the Python API invokes Amazon Bedrock using the AWS SDK credential chain.

1. Enable the selected model in Amazon Bedrock for your chosen Region.
2. Give the API runtime identity `bedrock:InvokeModel` permission for that model or inference profile. Use an IAM role for deployed services.
3. Set server-side `AWS_REGION` and `BEDROCK_MODEL_ID` (default: `amazon.nova-lite-v1:0`).
4. For local use, create and activate the project environment, then configure an AWS profile or SSO session:

   ```sh
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   aws configure
   npm run dev:api
   ```

5. Run `npm run dev` in a second terminal for the Vite client. It proxies `/api` requests to port 8080.

The navigator sends the current verified location catalog to Bedrock and accepts only returned IDs from that catalog, preventing it from inventing locations or addresses. If Bedrock is unavailable, the user sees the existing verified local matcher instead.

See Amazon's [Converse API guide](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html) for model access and runtime details.
