export function Avisos({ erro, mensagem }: { erro?: string; mensagem?: string }) {
  return (
    <>
      {erro && <p className="aviso aviso-critico" role="alert">{erro}</p>}
      {mensagem && <p className="aviso aviso-positivo" role="status">{mensagem}</p>}
    </>
  );
}
