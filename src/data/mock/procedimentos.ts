import { MockProcedimento } from '@/types';

export const mockProcedimentos: MockProcedimento[] = [
  { id: '1', nome: 'Aplicação de Toxina Botulínica', categoria: 'Toxina', duracao: 45, preco: 1500, status: 'ativo', descricao: 'Aplicação de toxina botulínica para rugas de expressão', materiaisNecessarios: ['1'] },
  { id: '2', nome: 'Preenchimento Labial', categoria: 'Preenchimento', duracao: 60, preco: 2500, status: 'ativo', descricao: 'Preenchimento labial com ácido hialurônico', materiaisNecessarios: ['3'] },
  { id: '3', nome: 'Preenchimento de Malar', categoria: 'Preenchimento', duracao: 60, preco: 3000, status: 'ativo', descricao: 'Volumização da região malar', materiaisNecessarios: ['4'] },
  { id: '4', nome: 'Harmonização Facial', categoria: 'Harmonização', duracao: 90, preco: 5000, status: 'ativo', descricao: 'Procedimento completo de harmonização', materiaisNecessarios: ['1', '3', '4'] },
  { id: '5', nome: 'Bioestimulador de Colágeno', categoria: 'Bioestimulador', duracao: 60, preco: 3500, status: 'ativo', descricao: 'Aplicação de Sculptra ou Radiesse', materiaisNecessarios: ['6', '7'] },
  { id: '6', nome: 'Skinbooster Facial', categoria: 'Hidratação', duracao: 45, preco: 1800, status: 'ativo', descricao: 'Hidratação injetável profunda', materiaisNecessarios: ['8', '9'] },
  { id: '7', nome: 'Fios de PDO', categoria: 'Fios', duracao: 90, preco: 4000, status: 'ativo', descricao: 'Fios de sustentação e estímulo', materiaisNecessarios: ['10'] },
  { id: '8', nome: 'Intradermoterapia Facial', categoria: 'Intradermoterapia', duracao: 30, preco: 600, status: 'ativo', descricao: 'Mesoterapia facial', materiaisNecessarios: ['11'] },
  { id: '9', nome: 'Microagulhamento', categoria: 'Estética Facial', duracao: 45, preco: 800, status: 'ativo', descricao: 'Microagulhamento com drug delivery', materiaisNecessarios: ['11'] },
  { id: '10', nome: 'Peeling Químico', categoria: 'Estética Facial', duracao: 30, preco: 500, status: 'ativo', descricao: 'Peeling para renovação celular', materiaisNecessarios: [] },
  { id: '11', nome: 'Limpeza de Pele Profunda', categoria: 'Estética Facial', duracao: 60, preco: 350, status: 'ativo', descricao: 'Limpeza com extração', materiaisNecessarios: [] },
  { id: '12', nome: 'Tratamento de Melasma', categoria: 'Estética Facial', duracao: 45, preco: 700, status: 'ativo', descricao: 'Protocolo para clareamento de manchas', materiaisNecessarios: ['12'] },
];
