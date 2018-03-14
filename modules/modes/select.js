import * as d3 from 'd3';
import _ from 'lodash';
import { d3keybinding } from '../lib/d3.keybinding.js';
import { t } from '../util/locale';

import { actionAddMidpoint } from '../actions/index';

import {
    behaviorBreathe,
    behaviorCopy,
    behaviorHover,
    behaviorLasso,
    behaviorPaste,
    behaviorSelect
} from '../behavior/index';

import {
    geoExtent,
    geoChooseEdge,
    geoPointInPolygon
} from '../geo/index';

import {
    osmNode,
    osmWay
} from '../osm/index';

import { modeBrowse } from './browse';
import { modeDragNode } from './drag_node';
import * as Operations from '../operations/index';
import { uiRadialMenu, uiSelectionList } from '../ui/index';
import { uiCmd } from '../ui/cmd';
import { utilEntityOrMemberSelector, utilEntitySelector } from '../util/index';


var relatedParent;


export function modeSelect(context, selectedIDs) {
    var mode = {
        id: 'select',
        button: 'browse'
    };

    var keybinding = d3keybinding('select'),
        timeout = null,
        behaviors = [
            behaviorCopy(context),
            behaviorPaste(context),
            behaviorBreathe(context),
            behaviorHover(context),
            behaviorSelect(context),
            behaviorLasso(context),
            modeDragNode(context).selectedIDs(selectedIDs).behavior
        ],
        inspector,
        radialMenu,
        newFeature = false,
        suppressMenu = false,
        follow = false;


    var wrap = context.container()
        .select('.inspector-wrap');


    function singular() {
        if (selectedIDs.length === 1) {
            return context.hasEntity(selectedIDs[0]);
        }
    }


    // find the common parent ways for nextVertex, previousVertex
    function commonParents() {
        var graph = context.graph(),
            commonParents = [];

        for (var i = 0; i < selectedIDs.length; i++) {
            var entity = context.hasEntity(selectedIDs[i]);
            if (!entity || entity.geometry(graph) !== 'vertex') {
                return [];  // selection includes some not vertexes
            }

            var currParents = _.map(graph.parentWays(entity), 'id');
            if (!commonParents.length) {
                commonParents = currParents;
                continue;
            }

            commonParents = _.intersection(commonParents, currParents);
            if (!commonParents.length) {
                return [];
            }
        }

        return commonParents;
    }


    function singularParent() {
        var parents = commonParents();
        if (!parents) {
            relatedParent = null;
            return null;
        }

        // relatedParent is used when we visit a vertex with multiple
        // parents, and we want to remember which parent line we started on.

        if (parents.length === 1) {
            relatedParent = parents[0];  // remember this parent for later
            return relatedParent;
        }

        if (parents.indexOf(relatedParent) !== -1) {
            return relatedParent;   // prefer the previously seen parent
        }

        return parents[0];
    }


    function closeMenu() {
        if (radialMenu) {
            context.surface().call(radialMenu.close);
        }
    }


    function positionMenu() {
        if (suppressMenu || !radialMenu) { return; }

        var entity = singular();
        if (entity && context.geometry(entity.id) === 'relation') {
            suppressMenu = true;
        } else if (entity && entity.type === 'node') {
            radialMenu.center(context.projection(entity.loc));
        } else {
            var point = context.mouse(),
                viewport = geoExtent(context.projection.clipExtent()).polygon();
            if (geoPointInPolygon(point, viewport)) {
                radialMenu.center(point);
            } else {
                suppressMenu = true;
            }
        }
    }


    function showMenu() {
        closeMenu();
        if (!suppressMenu && radialMenu) {
            context.surface().call(radialMenu);
        }
    }


    function toggleMenu() {
        if (d3.select('.radial-menu').empty()) {
            showMenu();
        } else {
            closeMenu();
        }
    }


    mode.selectedIDs = function() {
        return selectedIDs;
    };


    mode.reselect = function() {
        var surfaceNode = context.surface().node();
        if (surfaceNode.focus) {   // FF doesn't support it
            surfaceNode.focus();
        }

        positionMenu();
        showMenu();
    };


    mode.newFeature = function(_) {
        if (!arguments.length) return newFeature;
        newFeature = _;
        return mode;
    };


    mode.suppressMenu = function(_) {
        if (!arguments.length) return suppressMenu;
        suppressMenu = _;
        return mode;
    };


    mode.follow = function(_) {
        if (!arguments.length) return follow;
        follow = _;
        return mode;
    };


    mode.enter = function() {

        function update() {
            closeMenu();
            if (_.some(selectedIDs, function(id) { return !context.hasEntity(id); })) {
                // Exit mode if selected entity gets undone
                context.enter(modeBrowse(context));
            }
        }


        function dblclick() {
            var target = d3.select(d3.event.target),
                datum = target.datum();

            if (datum instanceof osmWay && !target.classed('fill')) {
                var choice = geoChooseEdge(context.childNodes(datum), context.mouse(), context.projection),
                    node = osmNode();

                var prev = datum.nodes[choice.index - 1],
                    next = datum.nodes[choice.index];

                context.perform(
                    actionAddMidpoint({loc: choice.loc, edge: [prev, next]}, node),
                    t('operations.add.annotation.vertex')
                );

                d3.event.preventDefault();
                d3.event.stopPropagation();
            }
        }


        function selectElements(drawn) {
            var surface = context.surface(),
                entity = singular();

            if (entity && context.geometry(entity.id) === 'relation') {
                suppressMenu = true;
                return;
            }

            surface.selectAll('.related')
                .classed('related', false);

            singularParent();
            if (relatedParent) {
                surface.selectAll(utilEntitySelector([relatedParent]))
                    .classed('related', true);
            }

            var selection = context.surface()
                .selectAll(utilEntityOrMemberSelector(selectedIDs, context.graph()));

            if (selection.empty()) {
                // Return to browse mode if selected DOM elements have
                // disappeared because the user moved them out of view..
                var source = d3.event && d3.event.type === 'zoom' && d3.event.sourceEvent;
                if (drawn && source && (source.type === 'mousemove' || source.type === 'touchmove')) {
                    context.enter(modeBrowse(context));
                }
            } else {
                selection
                    .classed('selected', true);
            }
        }


        function esc() {
            if (!context.inIntro()) {
                context.enter(modeBrowse(context));
            }
        }


        function firstVertex() {
            d3.event.preventDefault();
            var parent = singularParent();
            if (parent) {
                var way = context.entity(parent);
                context.enter(
                    modeSelect(context, [way.first()]).follow(true)
                );
            }
        }


        function lastVertex() {
            d3.event.preventDefault();
            var parent = singularParent();
            if (parent) {
                var way = context.entity(parent);
                context.enter(
                    modeSelect(context, [way.last()]).follow(true)
                );
            }
        }


        function previousVertex() {
            d3.event.preventDefault();
            var parent = singularParent();
            if (!parent) return;

            var way = context.entity(parent),
                length = way.nodes.length,
                curr = way.nodes.indexOf(selectedIDs[0]),
                index = -1;

            if (curr > 0) {
                index = curr - 1;
            } else if (way.isClosed()) {
                index = length - 2;
            }

            if (index !== -1) {
                context.enter(
                    modeSelect(context, [way.nodes[index]]).follow(true)
                );
            }
        }


        function nextVertex() {
            d3.event.preventDefault();
            var parent = singularParent();
            if (!parent) return;

            var way = context.entity(parent),
                length = way.nodes.length,
                curr = way.nodes.indexOf(selectedIDs[0]),
                index = -1;

            if (curr < length - 1) {
                index = curr + 1;
            } else if (way.isClosed()) {
                index = 0;
            }

            if (index !== -1) {
                context.enter(
                    modeSelect(context, [way.nodes[index]]).follow(true)
                );
            }
        }


        function nextParent() {
            d3.event.preventDefault();
            var parents = _.uniq(commonParents());
            if (!parents || parents.length < 2) return;

            var index = parents.indexOf(relatedParent);
            if (index < 0 || index > parents.length - 2) {
                relatedParent = parents[0];
            } else {
                relatedParent = parents[index + 1];
            }

            var surface = context.surface();
            surface.selectAll('.related')
                .classed('related', false);

            if (relatedParent) {
                surface.selectAll(utilEntitySelector([relatedParent]))
                    .classed('related', true);
            }
        }


        behaviors.forEach(function(behavior) {
            context.install(behavior);
        });

        var operations = _.without(d3.values(Operations), Operations.operationDelete)
                .map(function(o) { return o(selectedIDs, context); })
                .filter(function(o) { return o.available(); });

        operations.unshift(Operations.operationDelete(selectedIDs, context));

        keybinding
            .on(['[','pgup'], previousVertex)
            .on([']', 'pgdown'], nextVertex)
            .on([uiCmd('⌘['), 'home'], firstVertex)
            .on([uiCmd('⌘]'), 'end'], lastVertex)
            .on(['\\', 'pause'], nextParent)
            .on('⎋', esc, true)
            .on('space', toggleMenu);

        operations.forEach(function(operation) {
            operation.keys.forEach(function(key) {
                keybinding.on(key, function() {
                    if (!(context.inIntro() || operation.disabled())) {
                        operation();
                    }
                });
            });
        });

        d3.select(document)
            .call(keybinding);

        radialMenu = uiRadialMenu(context, operations);

        context.ui().sidebar
            .select(singular() ? singular().id : null, newFeature);

        context.history()
            .on('undone.select', update)
            .on('redone.select', update);

        context.map()
            .on('move.select', closeMenu)
            .on('drawn.select', selectElements);

        selectElements();

        var show = d3.event && !suppressMenu;

        if (show) {
            positionMenu();
        }

        if (follow) {
            var extent = geoExtent(),
                graph = context.graph();
            selectedIDs.forEach(function(id) {
                var entity = context.entity(id);
                extent._extend(entity.extent(graph));
            });

            var loc = extent.center();
            context.map().centerEase(loc);
        }

        timeout = window.setTimeout(function() {
            if (show) {
                showMenu();
            }

            context.surface()
                .on('dblclick.select', dblclick);
        }, 200);

        if (selectedIDs.length > 1) {
            var entities = uiSelectionList(context, selectedIDs);
            context.ui().sidebar.show(entities);
        }
    };


    mode.exit = function() {
        if (timeout) window.clearTimeout(timeout);

        if (inspector) wrap.call(inspector.close);

        behaviors.forEach(function(behavior) {
            context.uninstall(behavior);
        });

        keybinding.off();
        closeMenu();
        radialMenu = undefined;

        context.history()
            .on('undone.select', null)
            .on('redone.select', null);

        var surface = context.surface();

        surface
            .on('dblclick.select', null);

        surface
            .selectAll('.selected')
            .classed('selected', false);

        surface
            .selectAll('.related')
            .classed('related', false);

        context.map().on('drawn.select', null);
        context.ui().sidebar.hide();
    };


    return mode;
}
