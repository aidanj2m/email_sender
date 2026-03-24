export interface TemplateProps {
  recipientName?: string;
  recipientEmail: string;
  companyName?: string;
}

export function AidanTemplate({ recipientName }: TemplateProps): string {
  const firstName = recipientName?.split(" ")[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;">
<p>${greeting}</p>
<p>I built an AI messaging agent that actively sells multimillion-dollar homes in Princeton, NJ. It qualifies buyers, books tours, and handles follow-ups with zero human involvement.</p>
<p>That's just one thing we've done. Every client we work with receives a customized solution; we figure out where AI can be the biggest help in their operations and build exactly that. Nothing off the shelf.</p>
<p>I've attached a short deck. Worth a quick call?</p>
<p>Best,<br>Aidan McKenzie<br>Buzzed Technologies<br>(609) 664-1478</p>
</div>`;
}
