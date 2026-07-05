// Temporary page for testing components while we build them
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import Sidebar from '@/shared/components/Sidebar';
import Logo from '@/shared/components/Logo';

const cellStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--text-supporting, #786c57)',
  marginBottom: 4,
};

const typeScale = [
  { name: 'Header 1', size: '--type-h1-size', weight: '--type-h1-weight', tracking: '--type-h1-tracking' },
  { name: 'Header 2', size: '--type-h2-size', weight: '--type-h2-weight', tracking: '--type-h2-tracking' },
  { name: 'Header 3', size: '--type-h3-size', weight: '--type-h3-weight', tracking: '--type-h3-tracking' },
  { name: 'Subtitle', size: '--type-subtitle-size', weight: '--type-subtitle-weight' },
  { name: 'Body', size: '--type-body-size', weight: '--type-body-weight' },
  { name: 'Button Text', size: '--type-button-size', weight: '--type-button-weight' },
  { name: 'small', size: '--type-small-size', weight: '--type-small-weight' },
  { name: 'Supporting', size: '--type-supporting-size', weight: '--type-supporting-weight' },
];

export default function App() {
  return (
    <div style={{ padding: 40, paddingLeft: 132, maxWidth: 1200, margin: '0 auto' }}>
      <Logo />
      <Sidebar />
      <h1 style={{ color: 'var(--text-title, #0f3d2e)', marginBottom: 32 }}>
        Typography
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 72 }}>
        {typeScale.map((t) => (
          <div key={t.name}>
            <span style={labelStyle}>{t.name}</span>
            <div
              style={{
                fontSize: `var(${t.size})`,
                fontWeight: `var(${t.weight})`,
                letterSpacing: t.tracking ? `var(${t.tracking})` : undefined,
                color: 'var(--text-body-2, #463e31)',
              }}
            >
              The quick brown fox jumps over the lazy dog
            </div>
            <div
              dir="rtl"
              lang="ar"
              style={{
                fontSize: `var(${t.size})`,
                fontWeight: `var(${t.weight})`,
                letterSpacing: t.tracking ? `var(${t.tracking})` : undefined,
                color: 'var(--text-body-2, #463e31)',
              }}
            >
              نص تجريبي بخط تجوّل العربي
            </div>
          </div>
        ))}
      </div>

      <h1 style={{ color: 'var(--text-title, #0f3d2e)', marginBottom: 32 }}>
        Buttons
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 72 }}>
        {['primary', 'secondary', 'tertiary'].map((variant) => (
          <div key={variant} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Button variant={variant}>{variant} Button</Button>
            <Button variant={variant} leadingIcon>{variant} Button</Button>
            <Button variant={variant} trailingIcon>{variant} Button</Button>
            <Button variant={variant} disabled>{variant} Button</Button>
            {variant !== 'tertiary' && <Button variant={variant} iconOnly aria-label="next" />}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <h1 style={{ color: 'var(--text-title, #0f3d2e)', marginBottom: 32 }}>
        Input / TextField
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 48,
          alignItems: 'start',
        }}
      >
        <div style={cellStyle}>
          <span style={labelStyle}>Default</span>
          <Input label="Label" supportingText="Supporting text" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Filled</span>
          <Input label="Label" defaultValue="Input" supportingText="Supporting text" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Leading icon</span>
          <Input label="Search" leadingIcon supportingText="Supporting text" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Trailing icon</span>
          <Input label="Label" trailingIcon supportingText="Supporting text" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Leading + Trailing</span>
          <Input label="Search" leadingIcon trailingIcon defaultValue="Input" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Error</span>
          <Input label="Label" defaultValue="Input" trailingIcon error errorText="This field has an error" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Disabled</span>
          <Input label="Label" disabled supportingText="Supporting text" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Disabled (filled)</span>
          <Input label="Label" defaultValue="Input" trailingIcon disabled supportingText="Supporting text" />
        </div>

        <div style={cellStyle}>
          <span style={labelStyle}>Multiline (flixable)</span>
          <Input label="Description" multiline supportingText="Supporting text" />
        </div>
      </div>
    </div>
  );
}
