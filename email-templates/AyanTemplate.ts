export interface TemplateProps {
  recipientName?: string;
  recipientEmail: string;
  companyName?: string;
}

export function AyanTemplate({ recipientName, companyName }: TemplateProps): string {
  const firstName = recipientName?.split(" ")[0];
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const company = companyName ?? "your company";

  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;">
<p>${greeting}</p>
<p>You probably spend many thousands of $ on software platforms at ${company}, but my hunch is that you either don't use every feature or are unhappy that there's something specific missing. And you're overpaying on the annoying subscriptions.</p>
<p><b>My quick pitch:</b> I can build you custom tools and AI systems that you will see ROI for within a year (at most).</p>
<p>For specifically property dev companies, we've:</p>
<ul>
<li>Entirely replaced CRMs (90% cost reduction)</li>
<li>Deployed an agent that sells multi-million dollar homes in Princeton NJ</li>
<li>Automated tons of back office work including automatic checking for subcontractor insurance and forms, job bidding, and payroll management</li>
</ul>
<p>You can check out some more of our credentials and experience at <a href="https://buzzedtech.com">buzzedtech.com</a>. We're not trying to sell you another SaaS platform — we're a service that's going to build from the ground up.</p>
<p>I think 15 minutes would be really beneficial. Here's my #.</p>
<p>Best,<br>Ayan Khanna<br>CTO @ Buzzed Tech<br>+1 (609) 921-5645</p>
</div>`;
}
