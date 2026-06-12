import { config } from '../config';

// SMS adapter. "dev" mode logs the OTP and surfaces it to the client so
// the full flow is testable without an SMS gateway. "msg91" sends a real
// SMS via MSG91 Flow API — set MSG91_AUTH_KEY + MSG91_TEMPLATE_ID.
export interface SmsResult {
  delivered: boolean;
  devOtp?: string; // only populated in dev mode
}

export async function sendOtpSms(mobile: string, otp: string): Promise<SmsResult> {
  if (config.smsProvider === 'msg91') {
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: process.env.MSG91_AUTH_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        recipients: [{ mobiles: mobile.replace('+', ''), otp }],
      }),
    });
    return { delivered: res.ok };
  }
  // dev mode
  console.log(`[sms:dev] OTP for ${mobile}: ${otp}`);
  return { delivered: true, devOtp: otp };
}
