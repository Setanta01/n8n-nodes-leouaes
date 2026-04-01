import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import * as crypto from 'crypto';

function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + '|' + encrypted.toString('hex');
}

function decrypt(encryptedText: string, key: Buffer): string {
  const separatorIndex = encryptedText.indexOf('|');
  const ivHex = encryptedText.substring(0, separatorIndex);
  const dataHex = encryptedText.substring(separatorIndex + 1);
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export class LeouAes implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LeouAES',
    name: 'leouAes',
    icon: { light: 'file:leouaes.svg', dark: 'file:leouaes.dark.svg' },
    group: ['transform'],
    version: [1],
    description: 'Encrypt e Decrypt AES-256',
    defaults: { name: 'LeouAES' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Encrypt',
            value: 'encrypt',
            description: 'Encripta um texto usando AES-256',
            action: 'Encrypt a text',
          },
          {
            name: 'Decrypt',
            value: 'decrypt',
            description: 'Decripta um texto usando AES-256',
            action: 'Decrypt a text',
          },
        ],
        default: 'encrypt',
      },
      {
        displayName: 'AES Key (32 Characters)',
        name: 'aesKey',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
        placeholder: 'Chave de 32 caracteres (256 bits)',
        description: 'Chave secreta AES-256. Deve ter exatamente 32 caracteres.',
      },
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Digite o texto...',
        description: 'Texto a ser encriptado ou decriptado',
        typeOptions: { rows: 4 },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const aesKey = this.getNodeParameter('aesKey', itemIndex) as string;
        const text = this.getNodeParameter('text', itemIndex) as string;

        if (aesKey.length !== 32) {
          throw new NodeOperationError(
            this.getNode(),
            'A chave AES deve ter exatamente 32 caracteres (256 bits).',
            { itemIndex },
          );
        }

        const key = Buffer.from(aesKey, 'utf8');
        let output: string;

        if (operation === 'encrypt') {
          output = encrypt(text, key);
        } else {
          output = decrypt(text, key);
        }

        returnData.push({
          json: {
            operation,
            input: text,
            output,
            processedAt: new Date().toISOString(),
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
