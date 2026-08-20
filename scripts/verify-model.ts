/**
 * GLM 模型配置验证脚本
 * 
 * 用途: 验证项目使用的 GLM 模型配置
 * 运行: npx tsx scripts/verify-model.ts
 */

import { GLM_DEFAULT_MODEL, GLM_DEFAULT_ENDPOINT } from '../src/lib/glm/provider';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         GLM 模型配置验证                                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log();

// 1. 检查默认模型
console.log('📋 默认模型配置:');
console.log('   模型名称:', GLM_DEFAULT_MODEL);
console.log('   API 端点:', GLM_DEFAULT_ENDPOINT);
console.log();

// 2. 验证模型名称
const expectedModel = 'glm-4.1v-thinking-flash';
const isCorrectModel = GLM_DEFAULT_MODEL === expectedModel;

console.log('✓ 模型验证:');
console.log('   预期模型:', expectedModel);
console.log('   实际模型:', GLM_DEFAULT_MODEL);
console.log('   验证结果:', isCorrectModel ? '✅ 匹配' : '❌ 不匹配');
console.log();

// 3. 检查环境变量
console.log('🔧 环境变量检查:');
console.log('   GLM_API_KEY:', process.env.GLM_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('   GLM_MODEL:', process.env.GLM_MODEL ? `⚠️  已设置 (${process.env.GLM_MODEL})` : '✓ 未设置（正常）');
console.log();

if (process.env.GLM_MODEL) {
  console.log('⚠️  警告: 检测到 GLM_MODEL 环境变量');
  console.log('   当前代码不使用此环境变量');
  console.log('   硬编码使用:', GLM_DEFAULT_MODEL);
  console.log();
}

// 4. 模型特性说明
console.log('📊 GLM-4.1V-Thinking-Flash 特性:');
console.log('   ✓ 多模态能力 (图像 + 文本)');
console.log('   ✓ Thinking 推理模式');
console.log('   ✓ Flash 快速响应');
console.log('   ✓ 适合视频文案生成');
console.log();

// 5. 总结
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║ 验证结果                                                   ║');
console.log('╠════════════════════════════════════════════════════════════╣');
if (isCorrectModel) {
  console.log('║ ✅ 项目正确使用 glm-4.1v-thinking-flash 模型              ║');
} else {
  console.log('║ ❌ 模型配置异常，请检查代码                                ║');
}
console.log('╚════════════════════════════════════════════════════════════╝');
console.log();

// 6. 下一步建议
console.log('💡 如何进一步确认:');
console.log('   1. 上传测试视频');
console.log('   2. 查看 Worker 日志');
console.log('   3. 登录智谱 AI 控制台查看调用记录');
console.log('      https://open.bigmodel.cn/');
console.log();

// 7. 退出码
process.exit(isCorrectModel ? 0 : 1);
