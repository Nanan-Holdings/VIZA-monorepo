# AWS Rekognition (PROV-006)

## Layout

| Where                                                       | Contract                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `viza-fe/internal-website/lib/face/match.ts`                | Provider facade; `FACE_MATCH_PROVIDER=aws-rekognition` selects |
| `viza-fe/internal-website/app/actions/face-match.ts`        | Server action that downloads docs + calls `compareFaces`       |
| `viza-be/agent-backend/drizzle/0072_face_match_audit.sql`   | Audit row schema (provider/score/threshold/decision)           |

`@aws-sdk/client-rekognition` is lazy-loaded so type-check passes without the dep installed. Add it to the deploy target when flipping the provider.

## Human handoff

1. **IAM**: create a dedicated user `viza-face-match-prod` with **only** the `rekognition:CompareFaces` action allowed. Sample policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "rekognition:CompareFaces",
         "Resource": "*"
       }
     ]
   }
   ```

2. **Region**: pick the closest to your applicants (default `us-east-1`). EU applicants → `eu-west-1` for GDPR data residency.

3. **Envs** on the deploy target:
   ```
   FACE_MATCH_PROVIDER = aws-rekognition
   FACE_MATCH_THRESHOLD = 0.85
   AWS_REGION = us-east-1
   AWS_ACCESS_KEY_ID = AKIA...
   AWS_SECRET_ACCESS_KEY = ...
   ```

4. **Install** the SDK on the FE deploy target:
   ```bash
   cd viza-fe/internal-website && npm i @aws-sdk/client-rekognition
   ```

5. **Smoke test** against a staging applicant: upload passport + selfie, click "Run face match", confirm a `face_match_audit` row with `provider='aws-rekognition'` and a score in [0,1].

## Cost

CompareFaces ~ $0.001/call. Budget alarm in AWS Cost Explorer when monthly Rekognition spend > $50; surfaces in `/admin/costs` (OBS-003).

## Rotation

`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` rotate quarterly per `docs/security/secret-rotation.md`. Use the standard "two-key rolling cutover" — create the new key, deploy, then revoke the old.
