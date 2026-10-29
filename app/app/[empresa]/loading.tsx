export default function ACarregar() {
  return (
    <div style={{ display: 'grid', gap: 'var(--e-4)' }} aria-busy="true">
      <span className="esqueleto" style={{ blockSize: '7rem' }} />
      <span className="esqueleto" style={{ blockSize: '16rem' }} />
      <p role="status" className="so-leitor">A carregar.</p>
    </div>
  );
}
