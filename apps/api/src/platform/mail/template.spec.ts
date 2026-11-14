import { describe, expect, it } from 'vitest';
import { emailLayout } from './template.js';

const signIn = emailLayout({
  appUrl: 'https://figcit.vercel.app/',
  heading: 'Your sign-in link',
  preheader: 'Tap to open FigCit, or enter 123456.',
  paragraphs: ['Tap the button to open FigCit. The link works for 10 minutes.'],
  action: { label: 'Open FigCit', url: 'https://figcit.vercel.app/enter/link/?token=a&b=c' },
  code: { label: 'On another device? Enter this code instead:', value: '123456' },
  note: "If you didn't ask for this, you can ignore this email.",
});

describe('the FigCit email layout', () => {
  it('looks like the app: its cream page, white card, plum button and logo', () => {
    expect(signIn.html).toContain('background:#f5eede');
    expect(signIn.html).toContain('background:#5b3358');
    expect(signIn.html).toContain('src="https://figcit.vercel.app/icons/icon-192.png"');
    expect(signIn.html).toContain('<html lang="en-GB">');
  });

  it('escapes what it shows, links included', () => {
    expect(signIn.html).toContain('href="https://figcit.vercel.app/enter/link/?token=a&amp;b=c"');
    expect(signIn.html).toContain('didn&#39;t ask for this');
    const evil = emailLayout({
      appUrl: 'https://x.test',
      heading: '<script>x</script>',
      paragraphs: ['a & b'],
    });
    expect(evil.html).not.toContain('<script>');
    expect(evil.html).toContain('a &amp; b');
  });

  it('shows the code large, and the preheader only to inbox lists', () => {
    expect(signIn.html).toMatch(/letter-spacing:8px[^>]*>123456</);
    expect(signIn.html).toMatch(/display:none[^>]*>Tap to open FigCit, or enter 123456\.</);
  });

  it('has a plain-text twin with the same words, the link and the code', () => {
    expect(signIn.text).toBe(
      [
        'Your sign-in link',
        '',
        'Tap the button to open FigCit. The link works for 10 minutes.',
        '',
        'Open FigCit: https://figcit.vercel.app/enter/link/?token=a&b=c',
        '',
        'On another device? Enter this code instead: 123456',
        '',
        "If you didn't ask for this, you can ignore this email.",
        '',
        '— FigCit',
        'https://figcit.vercel.app',
      ].join('\n'),
    );
  });

  it('leaves out what an email does not have', () => {
    const plain = emailLayout({ appUrl: 'https://x.test', heading: 'Hello', paragraphs: ['One.'] });
    expect(plain.html).not.toContain('letter-spacing:8px');
    expect(plain.html).not.toContain('display:none');
    expect(plain.html).not.toContain('border-radius:999px;background');
  });
});
