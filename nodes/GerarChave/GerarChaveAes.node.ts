import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import * as crypto from 'crypto';

export class GerarChave implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Gerar Chave AES',
    name: 'gerarChaveAes',
    icon: { light: 'file:leouaes.svg', dark: 'file:leouaes.dark.svg' },
    group: ['transform'],
    version: [1],
    description: 'Gera uma chave aleatória de 32 caracteres para uso no LeouAES',
    defaults: { name: 'Gerar Chave AES' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    properties: [
      {
        displayName: 'Key Format',
        name: 'format',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Text (32 Characters)',
            value: 'text',
            description: 'Gera uma chave legível de 32 caracteres para usar direto no LeouAES',
            action: 'Generate a text key',
          },
          {
            name: 'Hex (64 Characters)',
            value: 'hex',
            description: 'Gera uma chave em formato hexadecimal',
            action: 'Generate a hex key',
          },
        ],
        default: 'text',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const format = this.getNodeParameter('format', itemIndex) as string;

        let key: string;
        if (format === 'text') {
          // Gera 32 bytes e converte para base64, pega exatamente 32 chars
          key = crypto.randomBytes(24).toString('base64').substring(0, 32);
        } else {
          // Gera 32 bytes em hex (64 chars)
          key = crypto.randomBytes(32).toString('hex');
        }

        returnData.push({
          json: {
            key,
            format,
            length: key.length,
            generatedAt: new Date().toISOString(),
            tip: format === 'text'
              ? 'Use esta chave de 32 caracteres no node LeouAES'
              : 'Esta chave hex tem 64 chars — use os primeiros 32 no LeouAES',
          },
          pairedItem: itemIndex,
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: itemIndex,
          });
        } else {
          throw new NodeOperationError(this.getNode(), error, { itemIndex });
        }
      }
    }

    return [returnData];
  }
}
