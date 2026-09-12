// tests/item/item-form.test.js
// 发布表单的校验与请求体组装（纯函数，无需页面环境）。
// 规则来自总纲 §9.3：标题 2～80；描述 10～2000；售价 > 0 且最多两位小数；
// 原价为空或 ≥ 售价；图片 1～9 张；分类与成色必选。

const { describe, it } = require('node:test');
const assert = require('node:assert');

const itemForm = require('../../pages/publish/item-form.js');
const itemApi = require('../../services/item-api.js');

function validForm(overrides) {
  return Object.assign(
    {
      title: '九成新自行车',
      description: '骑了半年，车况良好，可小刀，校内自提',
      price: '180',
      originalPrice: '',
      condition: 'GOOD',
      categoryId: '12',
      imageFileIds: ['3', '4']
    },
    overrides || {}
  );
}

describe('发布表单校验', function () {
  it('合法表单通过校验', function () {
    assert.equal(itemForm.validateItemForm(validForm()), null);
  });

  it('标题长度必须在 2～80 之间', function () {
    assert.ok(itemForm.validateItemForm(validForm({ title: '车' })));
    assert.ok(itemForm.validateItemForm(validForm({ title: '' })));
    assert.ok(itemForm.validateItemForm(validForm({ title: '   ' })));
    assert.ok(itemForm.validateItemForm(validForm({ title: 'x'.repeat(81) })));
    assert.equal(itemForm.validateItemForm(validForm({ title: 'x'.repeat(80) })), null);
    // 前后的空白不计入长度，与后端 trim 后校验一致。
    assert.equal(itemForm.validateItemForm(validForm({ title: '  单车  ' })), null);
  });

  it('描述长度必须在 10～2000 之间', function () {
    assert.ok(itemForm.validateItemForm(validForm({ description: '九成新' })));
    assert.ok(itemForm.validateItemForm(validForm({ description: 'x'.repeat(2001) })));
    assert.equal(itemForm.validateItemForm(validForm({ description: 'x'.repeat(2000) })), null);
  });

  it('售价必须是大于 0 且最多两位小数的数字', function () {
    assert.ok(itemForm.validateItemForm(validForm({ price: '' })));
    assert.ok(itemForm.validateItemForm(validForm({ price: '0' })));
    assert.ok(itemForm.validateItemForm(validForm({ price: '-1' })));
    assert.ok(itemForm.validateItemForm(validForm({ price: '10.999' })));
    assert.ok(itemForm.validateItemForm(validForm({ price: '十元' })));
    assert.ok(itemForm.validateItemForm(validForm({ price: '1e3' })));
    assert.equal(itemForm.validateItemForm(validForm({ price: '0.01' })), null);
    assert.equal(itemForm.validateItemForm(validForm({ price: '180.5' })), null);
  });

  it('售价不能超过数据库 DECIMAL(10,2) 的上限', function () {
    const tooLarge = '100000000';
    assert.equal(itemForm.MONEY_MAX, 99999999.99);
    assert.ok(/金额不能超过/.test(itemForm.validateItemForm(validForm({ price: tooLarge }))));
    assert.equal(itemForm.validateItemForm(validForm({ price: '99999999.99' })), null);
  });

  it('原价可以留空，填写时不得低于售价', function () {
    assert.equal(itemForm.validateItemForm(validForm({ originalPrice: '' })), null);
    assert.ok(itemForm.validateItemForm(validForm({ price: '180', originalPrice: '100' })));
    assert.equal(itemForm.validateItemForm(validForm({ price: '180', originalPrice: '180' })), null);
    assert.ok(itemForm.validateItemForm(validForm({ originalPrice: 'abc' })));
    assert.ok(itemForm.validateItemForm(validForm({ originalPrice: '100000000' })));
  });

  it('成色、分类与图片数量必填', function () {
    assert.ok(itemForm.validateItemForm(validForm({ condition: '' })));
    assert.ok(itemForm.validateItemForm(validForm({ categoryId: null })));
    assert.ok(itemForm.validateItemForm(validForm({ imageFileIds: [] })));
    assert.equal(
      itemForm.validateItemForm(validForm({ imageFileIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] })),
      null
    );
    assert.ok(
      itemForm.validateItemForm(
        validForm({ imageFileIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] })
      )
    );
  });
});

describe('发布请求体组装', function () {
  it('去除首尾空白并把金额归一化为两位小数', function () {
    const payload = itemForm.buildPayload(validForm({ title: '  单车  ', price: '180.5' }));
    assert.equal(payload.title, '单车');
    assert.equal(payload.price, '180.50');
    assert.equal(payload.originalPrice, null);
    assert.deepEqual(payload.imageFileIds, ['3', '4']);
    assert.equal(payload.version, undefined);
  });

  it('填写原价时一并归一化', function () {
    const payload = itemForm.buildPayload(validForm({ originalPrice: '299' }));
    assert.equal(payload.originalPrice, '299.00');
  });

  it('编辑时附带乐观锁版本号', function () {
    const payload = itemForm.buildPayload(validForm(), 7);
    assert.equal(payload.version, 7);
  });

  it('组装结果直接通过契约的金额模式', function () {
    const payload = itemForm.buildPayload(validForm({ price: '180.5', originalPrice: '299' }));
    assert.match(payload.price, /^(0|[1-9][0-9]*)\.[0-9]{2}$/);
    assert.match(payload.originalPrice, /^(0|[1-9][0-9]*)\.[0-9]{2}$/);
    assert.equal(payload.price, itemApi.normalizeMoney('180.5'));
  });
});
