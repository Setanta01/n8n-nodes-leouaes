import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const KEY_FILE = path.join(__dirname, '..', '..', 'leouaes.key');

function getOrCreateKey(): Buffer {
  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE, 'utf8').trim();
    return Buffer.from(raw, 'hex');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), 'utf8');
  return key;
}

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

export class LeouAES implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LeouAES',
    name: 'leouAES',
    icon: { light: 'file:leouaes.svg', dark: 'file:leouaes.dark.svg' },
    group: ['transform'],
    version: [1],
    description: 'Encrypt e Decrypt AES-256 com chave persistente',
    defaults: { name: 'LeouAES' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    properties: [
      {
        displayName: 'Operação',
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
        displayName: 'Texto',
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

    let key: Buffer;
    try {
      key = getOrCreateKey();
    } catch (error) {
      throw new NodeOperationError(this.getNode(), 'Erro ao carregar ou criar a chave AES: ' + error.message);
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const text = this.getNodeParameter('text', itemIndex) as string;

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
            keyFile: KEY_FILE,
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
