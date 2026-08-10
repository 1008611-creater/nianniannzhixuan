(() => {
  "use strict";

  const removable = new Set([
    "童装内容制作",
    "登录后继续当前模板与素材选择，并在账户页查看项目、任务和结算记录。",
    "账户额度、生成任务和项目记录已与当前账号关联。",
    "登录后查看项目、素材与制作进度。",
    "归档的项目会显示在这里。",
    "从一个动作模板开始创建第一条视频。",
    "返回模板页重新选择制作模板。",
    "登录后查看 tz币、生图额度和钱包余额。",
    "充值、领取、做图和视频生成都会记录在这里。失败或进行中的任务会标记为未扣费。",
    "当前还没有账单流水。充值、领取或生成任务后会自动记录。",
    "只为真正产出的成片结算。",
    "Billing",
    "从模板到首帧、再到动作迁移，每一步的扣费边界都清楚可见。失败、阻断与未完成任务不扣视频运行币。",
    "成功返回视频后结算",
    "按实际生成张数结算",
    "不扣视频运行币",
    "图片生成会在提交前说明预计消耗；助手提出生成建议时，需要你确认后才会创建任务。",
    "动作迁移按照实际输出时长计算运行币。平台资源不足、任务失败或被阻断时不扣视频运行币。",
    "图片、视频、充值、兑换与每日领取都会进入账户流水，方便门店与团队核对制作成本。",
    "本次制作会从这里结算。",
    "图片 ¥0.20/张；当前账户钱包最多可兑换 0 张。",
    "制作计费",
    "制作顺序",
    "用一次完整项目理解成本。",
    "模板浏览不收费。选择动作后，先生成商品首帧；确认首帧符合服装、人物和门店空间要求，再开始动作迁移。",
    "输入卡密后，TZ 将一次性计入当前账户。",
  ]);

  const removeCopy = () => {
    document.querySelectorAll(".pricing-principles,.pricing-production-flow,#app > footer.site-footer").forEach((node) => node.remove());
    document.querySelectorAll("p, small, .eyebrow, .billing-empty, span, h1, h2").forEach((node) => {
      if (removable.has((node.textContent || "").replace(/\s+/g, " ").trim())) node.remove();
    });
  };

  const style = document.createElement("style");
  style.textContent = "#app > header.site-header{position:sticky!important;top:0!important;z-index:1000!important;isolation:isolate}";
  document.head.appendChild(style);
  removeCopy();
  new MutationObserver(removeCopy).observe(document.documentElement, { childList: true, subtree: true });
})();
