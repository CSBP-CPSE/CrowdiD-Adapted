import * as d3 from 'd3';
import { d3keybinding } from '../lib/d3.keybinding.js';
import { t } from '../util/locale';
import { modeBrowse, modeSelect } from './index';
import { actionMove, actionNoop } from '../actions/index';
import { behaviorEdit } from '../behavior/index';


export function modeMove(context, entityIDs, baseGraph) {
    var mode = {
        id: 'move',
        button: 'browse'
    };

    var keybinding = d3keybinding('move'),
        edit = behaviorEdit(context),
        annotation = entityIDs.length === 1 ?
            t('operations.move.annotation.' + context.geometry(entityIDs[0])) :
            t('operations.move.annotation.multiple'),
        cache,
        origin,
        nudgeInterval;


    function vecSub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }


    function edge(point, size) {
        var pad = [30, 100, 30, 100];
        if (point[0] > size[0] - pad[0]) return [-10, 0];
        else if (point[0] < pad[2]) return [10, 0];
        else if (point[1] > size[1] - pad[1]) return [0, -10];
        else if (point[1] < pad[3]) return [0, 10];
        return null;
    }


    function startNudge(nudge) {
        if (nudgeInterval) window.clearInterval(nudgeInterval);
        nudgeInterval = window.setInterval(function() {
            context.pan(nudge);

            var currMouse = context.mouse(),
                origMouse = context.projection(origin),
                delta = vecSub(vecSub(currMouse, origMouse), nudge),
                action = actionMove(entityIDs, delta, context.projection, cache);

            context.overwrite(action, annotation);

        }, 50);
    }


    function stopNudge() {
        if (nudgeInterval) window.clearInterval(nudgeInterval);
        nudgeInterval = null;
    }


    function move() {
        var currMouse = context.mouse(),
            origMouse = context.projection(origin),
            delta = vecSub(currMouse, origMouse),
            action = actionMove(entityIDs, delta, context.projection, cache);

        context.overwrite(action, annotation);

        var nudge = edge(currMouse, context.map().dimensions());
        if (nudge) startNudge(nudge);
        else stopNudge();
    }


    function finish() {
        d3.event.stopPropagation();
        context.enter(modeSelect(context, entityIDs).suppressMenu(true));
        stopNudge();
    }


    function cancel() {
        if (baseGraph) {
            while (context.graph() !== baseGraph) context.pop();
            context.enter(modeBrowse(context));
        } else {
            context.pop();
            context.enter(modeSelect(context, entityIDs).suppressMenu(true));
        }
        stopNudge();
    }


    function undone() {
        context.enter(modeBrowse(context));
    }


    mode.enter = function() {
        origin = context.map().mouseCoordinates();
        cache = {};

        context.install(edit);

        context.perform(
            actionNoop(),
            annotation
        );

        context.surface()
            .on('mousemove.move', move)
            .on('click.move', finish);

        context.history()
            .on('undone.move', undone);

        keybinding
            .on('⎋', cancel)
            .on('↩', finish);

        d3.select(document)
            .call(keybinding);
    };


    mode.exit = function() {
        stopNudge();

        context.uninstall(edit);

        context.surface()
            .on('mousemove.move', null)
            .on('click.move', null);

        context.history()
            .on('undone.move', null);

        keybinding.off();
    };


    return mode;
}
