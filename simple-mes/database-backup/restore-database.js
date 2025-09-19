/**
 * SimpleMES数据库快速恢复工具
 * 自动化数据库恢复流程
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 配置
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'simplemes_db',
  username: 'postgres',
  password: 'root'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function findBackupFiles() {
  const files = fs.readdirSync(__dirname);
  const backupFiles = files.filter(f => 
    f.endsWith('.sql') && f.includes('backup') && f.includes('full')
  ).sort().reverse(); // 最新的在前
  
  return backupFiles;
}

async function restoreDatabase() {
  console.log('🔄 SimpleMES数据库恢复工具');
  console.log('================================');
  
  // 查找备份文件
  const backupFiles = await findBackupFiles();
  
  if (backupFiles.length === 0) {
    console.log('❌ 未找到备份文件！');
    console.log('请确保备份文件存在于当前目录中。');
    process.exit(1);
  }
  
  console.log('📋 找到以下备份文件:');
  backupFiles.forEach((file, index) => {
    const stats = fs.statSync(path.join(__dirname, file));
    console.log(`${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
  console.log('');
  
  // 选择备份文件
  const fileChoice = await askQuestion('请选择要恢复的备份文件编号 (直接回车选择最新): ');
  const selectedFile = fileChoice ? backupFiles[parseInt(fileChoice) - 1] : backupFiles[0];
  
  if (!selectedFile) {
    console.log('❌ 无效的选择！');
    process.exit(1);
  }
  
  console.log(`📁 选择的备份文件: ${selectedFile}`);
  console.log('');
  
  // 确认恢复
  console.log('⚠️  警告: 此操作将完全重建数据库，现有数据将被删除！');
  const confirm = await askQuestion('确认继续吗？(y/N): ');
  
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log('❌ 操作已取消');
    process.exit(0);
  }
  
  console.log('');
  console.log('🔄 开始恢复数据库...');
  
  try {
    // 方法1: 尝试直接执行SQL文件
    await restoreFromSQL(selectedFile);
  } catch (error) {
    console.log('⚠️  SQL恢复失败，尝试Prisma方式...');
    try {
      await restoreFromPrisma();
    } catch (prismaError) {
      console.error('❌ 所有恢复方法都失败了');
      console.error('SQL错误:', error.message);
      console.error('Prisma错误:', prismaError.message);
      process.exit(1);
    }
  }
  
  console.log('');
  console.log('✅ 数据库恢复完成！');
  console.log('');
  console.log('🔑 默认登录账号:');
  console.log('- admin/admin (系统管理员)');
  console.log('- supervisor/supervisor (生产主管)');
  console.log('- engineer/engineer (工艺工程师)');
  console.log('- operator/operator (生产操作员)');
  console.log('- client/client (工位客户端)');
  console.log('');
  console.log('🌐 访问地址: http://localhost:3000');
  
  rl.close();
}

async function restoreFromSQL(backupFile) {
  return new Promise((resolve, reject) => {
    const backupPath = path.join(__dirname, backupFile);
    
    console.log('📥 使用psql恢复数据库...');
    
    // 设置密码环境变量
    const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };
    
    // 使用psql执行SQL文件
    const psqlCommand = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -f "${backupPath}"`;
    
    exec(psqlCommand, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      if (stderr && !stderr.includes('NOTICE')) {
        console.log('⚠️  警告信息:', stderr);
      }
      
      console.log('✅ SQL文件执行成功');
      resolve();
    });
  });
}

async function restoreFromPrisma() {
  return new Promise((resolve, reject) => {
    console.log('📥 使用Prisma恢复数据库...');
    
    // 检查是否存在schema文件
    const schemaPath = path.join(__dirname, 'schema.prisma');
    const seedPath = path.join(__dirname, 'seed.ts');
    
    if (!fs.existsSync(schemaPath)) {
      reject(new Error('未找到schema.prisma文件'));
      return;
    }
    
    // 复制schema到正确位置
    const targetSchemaPath = path.join(__dirname, '../prisma/schema.prisma');
    fs.copyFileSync(schemaPath, targetSchemaPath);
    
    console.log('🔄 应用数据库Schema...');
    exec('npx prisma db push --force-reset', { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      console.log('✅ Schema应用成功');
      
      // 运行种子数据
      if (fs.existsSync(seedPath)) {
        console.log('🌱 运行种子数据...');
        exec('npx prisma db seed', { cwd: path.join(__dirname, '..') }, (seedError, seedStdout, seedStderr) => {
          if (seedError) {
            console.log('⚠️  种子数据运行失败，但Schema已恢复');
          } else {
            console.log('✅ 种子数据运行成功');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// 处理错误
process.on('unhandledRejection', (error) => {
  console.error('❌ 未处理的错误:', error.message);
  process.exit(1);
});

// 处理Ctrl+C
process.on('SIGINT', () => {
  console.log('\n❌ 操作已取消');
  rl.close();
  process.exit(0);
});

// 运行恢复
restoreDatabase();