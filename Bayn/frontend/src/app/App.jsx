import Input from '@/shared/components/Input';

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

export default function App() {
  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
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
