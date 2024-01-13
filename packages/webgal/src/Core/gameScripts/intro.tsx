import { ISentence } from '@/Core/controller/scene/sceneInterface';
import { IPerform } from '@/Core/Modules/perform/performInterface';
import React from 'react';
import ReactDOM from 'react-dom';
import styles from '@/Stage/FullScreenPerform/fullScreenPerform.module.scss';
import { nextSentence } from '@/Core/controller/gamePlay/nextSentence';
import { PerformController } from '@/Core/Modules/perform/performController';
import { logger } from '@/Core/util/logger';
import { WebGAL } from '@/Core/WebGAL';

/**
 * 相对于最后一个元素出现，Perform额外增加的时长
 */
const PERFORM_EXTRA_DURATION = 1000;

/**
 * 显示一小段黑屏演示
 * @param sentence
 */
export const intro = (sentence: ISentence): IPerform => {
  /**
   * intro 内部控制
   */

  // TODO
  let doneByNextEvent = false;
  sentence.args.forEach((e) => {
    if (e.key === 'doneByNextEvent') {
      doneByNextEvent = true;
    }
  });
  const performName = `introPerform${Math.random().toString()}`;
  let fontSize: string | undefined;
  let backgroundColor: any = 'rgba(0, 0, 0, 1)';
  let color: any = 'rgba(255, 255, 255, 1)';
  const animationClass: any = (type: string, length = 0) => {
    switch (type) {
      case 'fadeIn':
        return styles.fadeIn;
      case 'slideIn':
        return styles.slideIn;
      case 'typingEffect':
        return `${styles.typingEffect} ${length}`;
      case 'pixelateEffect':
        return styles.pixelateEffect;
      case 'revealAnimation':
        return styles.revealAnimation;
      default:
        return styles.fadeIn;
    }
  };
  let chosenAnimationClass = styles.fadeIn;
  let delayTime = 1500;

  for (const e of sentence.args) {
    if (e.key === 'backgroundColor') {
      backgroundColor = e.value || 'rgba(0, 0, 0, 1)';
    }
    if (e.key === 'fontColor') {
      color = e.value || 'rgba(255, 255, 255, 1)';
    }
    if (e.key === 'fontSize') {
      switch (e.value) {
        case 'small':
          fontSize = '280%';
          break;
        case 'medium':
          fontSize = '350%';
          break;
        case 'large':
          fontSize = '420%';
          break;
      }
    }
    if (e.key === 'animation') {
      chosenAnimationClass = animationClass(e.value);
    }
    if (e.key === 'delayTime') {
      const parsedValue = parseInt(e.value.toString(), 10);
      delayTime = isNaN(parsedValue) ? delayTime : parsedValue;
    }
  }

  const introContainerStyle = {
    background: backgroundColor,
    color: color,
    fontSize: fontSize || '350%',
    width: '100%',
    height: '100%',
  };
  let currentBlockingNext = true;
  let customTimeoutHandlerCallNextSentence = false;
  /*
    不论是首次创建的Timeout、加速后新建的Timeout，均对应“当所有node展示完成”，然后使用该timeoutBackendLogic；
    内容为：
    （1）若doneByNextEvent，则取消自身blockingNext（并不需要卸载自身）；使得下一次（用户触发的）nextSentence()内部逻辑即可满足需求；
    （2）否则，主动卸载自身。并视情况可选地额外调用nextSentence。
    */
  let timeoutBackendLogic = () => {
    if (doneByNextEvent) {
      currentBlockingNext = false;
    } else {
      WebGAL.gameplay.performController.unmountPerform(performName);
      if (customTimeoutHandlerCallNextSentence) {
        setTimeout(nextSentence, 0);
      }
    }
  };
  let customTimeout = setTimeout(() => {});
  const toNextIntroElement = () => {
    /*
    Next事件导致：
    （1）每个动画提早1个步长；
    （2）timeoutBackendLogic立刻执行，或timeoutBackendLogic的发生提早1个步长; 实现方式是重建一个Timeout任务
    */
    const introContainer = document.getElementById('introContainer');
    if (introContainer) {
      const children = introContainer.childNodes[0].childNodes[0].childNodes as any;
      const len = children.length;
      children.forEach((node: HTMLDivElement, index: number) => {
        const currentDelay = Number(node.style.animationDelay.split('ms')[0]);
        if (currentDelay > 0) {
          node.style.animationDelay = `${currentDelay - delayTime}ms`;
        }
        if (index === len - 1) {
          if (currentDelay === 0) {
            clearTimeout(customTimeout);
            timeoutBackendLogic()
          } else {
            clearTimeout(customTimeout);
            customTimeoutHandlerCallNextSentence = true;
            customTimeout = setTimeout(timeoutBackendLogic, currentDelay + PERFORM_EXTRA_DURATION);
          }
        }
      });
    }
  };

  /**
   * 接受 next 事件
   */
  WebGAL.eventBus.on('__NEXT', toNextIntroElement);

  const introArray: Array<string> = sentence.content.split(/\|/);
  const showIntro = introArray.map((e, i) => (
    <div
      key={'introtext' + i + Math.random().toString()}
      style={{ animationDelay: `${delayTime * i}ms` }}
      className={chosenAnimationClass}
    >
      {e}
      {e === '' ? '\u00a0' : ''}
    </div>
  ));
  const intro = (
    <div style={introContainerStyle}>
      <div style={{ padding: '3em 4em 3em 4em' }}>{showIntro}</div>
    </div>
  );
  ReactDOM.render(intro, document.getElementById('introContainer'));
  const introContainer = document.getElementById('introContainer');

  if (introContainer) {
    introContainer.style.display = 'block';
  }
  let duration;
  if (doneByNextEvent) {
    // 跳过PerformController建立的（首次）timeout任务，自定义之
    duration = -1;
    customTimeout = setTimeout(timeoutBackendLogic, PERFORM_EXTRA_DURATION + delayTime * introArray.length);
  } else {
    duration = PERFORM_EXTRA_DURATION + delayTime * introArray.length;
  }
  return {
    performName,
    duration: duration,
    isHoldOn: false,
    stopFunction: () => {
      const introContainer = document.getElementById('introContainer');
      if (introContainer) {
        introContainer.style.display = 'none';
      }
      WebGAL.eventBus.off('__NEXT', toNextIntroElement);
    },
    blockingNext: () => currentBlockingNext,
    blockingAuto: () => true,
    stopTimeout: undefined, // 暂时不用，后面会交给自动清除
    goNextWhenOver: true,
  };
};
