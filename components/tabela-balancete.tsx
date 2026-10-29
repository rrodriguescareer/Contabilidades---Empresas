import Link from 'next/link';
import type { LinhaBalancete } from '@/lib/cegid';
import { totais } from '@/lib/contas';
import { valor } from '@/lib/formato';
import p from './paginas.module.css';

/** O balancete: acumulados a débito e a crédito e o saldo, devedor ou credor. */
export function TabelaBalancete({ linhas, todas, base, ano }: { linhas: LinhaBalancete[]; todas: LinhaBalancete[]; base: string; ano: number }) {
  const t = totais(todas);
  return (
    <div className={p.envolveTabela}>
      <table className={p.tabela}>
        <thead>
          <tr>
            <th scope="col">Conta</th>
            <th scope="col">Descrição</th>
            <th scope="col" className={`${p.num} ${p.mov}`}>Débito</th>
            <th scope="col" className={`${p.num} ${p.mov}`}>Crédito</th>
            <th scope="col" className={p.num}>Saldo devedor</th>
            <th scope="col" className={p.num}>Saldo credor</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.conta} data-nivel={Math.min(l.conta.length, 3)}>
              <td className={p.conta}>
                <Link href={`${base}/extrato?conta=${l.conta}&ano=${ano}`} title="Ver os movimentos desta conta">{l.conta}</Link>
              </td>
              <td>{l.descricao}</td>
              <td className={`${p.num} ${p.mov}`}>{valor(l.debito)}</td>
              <td className={`${p.num} ${p.mov}`}>{valor(l.credito)}</td>
              <td className={p.num}>{l.saldo > 0.005 ? valor(l.saldo) : ''}</td>
              <td className={`${p.num} ${p.credor}`}>{l.saldo < -0.005 ? valor(-l.saldo) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Totais</td>
            <td className={`${p.num} ${p.mov}`}>{valor(t.debito)}</td>
            <td className={`${p.num} ${p.mov}`}>{valor(t.credito)}</td>
            <td className={p.num}>{valor(t.devedor)}</td>
            <td className={p.num}>{valor(t.credor)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
