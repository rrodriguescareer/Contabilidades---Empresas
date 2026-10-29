import Link from 'next/link';
import p from './paginas.module.css';

/** Quando o Cegid não responde, ou ainda não há o que mostrar: diz porquê, em
    vez de uma tabela vazia. */
export function Indisponivel({ erro, motivo, base }: { erro: string; motivo: string; base: string }) {
  const titulo =
    motivo === 'credenciais' ? 'Esta empresa ainda não está ligada ao Cegid'
    : motivo === 'corte' ? 'Ainda não há período fechado para mostrar'
    : motivo === 'configuracao' ? 'A ligação ao Cegid está a ser preparada'
    : motivo === 'exercicio' ? 'Este exercício não existe no Cegid'
    : 'O Cegid não respondeu';
  const nota =
    motivo === 'credenciais' ? 'Os saldos e balancetes aparecem aqui assim que o contabilista fizer a ligação. Os documentos do mês e as mensagens já funcionam.'
    : motivo === 'corte' ? 'Os valores só são mostrados até à data de corte, depois de revistos pelo contabilista.'
    : motivo === 'cegid' ? 'Tente novamente dentro de alguns minutos. Se continuar, avise o contabilista.'
    : '';
  return (
    <div className={`${p.cartao} ${p.indisponivel}`} role="status">
      <h2>{titulo}</h2>
      <p className="suave">{erro}</p>
      {nota && <p className="pequeno suave">{nota}</p>}
      <Link className="btn btn-secundario btn-sm" href={`${base}/mensagens`}>Falar com o contabilista</Link>
    </div>
  );
}
