import _ from 'lodash';
import { t } from '../util/locale';
import { modeSelect } from '../modes/index';
import { actionSplit } from '../actions/index';


export function operationSplit(selectedIDs, context) {
    var vertices = _.filter(selectedIDs, function(entityId) {
        return context.geometry(entityId) === 'vertex';
    });

    var entityId = vertices[0],
        action = actionSplit(entityId);

    if (selectedIDs.length > 1) {
        action.limitWays(_.without(selectedIDs, entityId));
    }


    var operation = function() {
        var annotation;

        var ways = action.ways(context.graph());
        if (ways.length === 1) {
            annotation = t('operations.split.annotation.' + context.geometry(ways[0].id));
        } else {
            annotation = t('operations.split.annotation.multiple', {n: ways.length});
        }

        var difference = context.perform(action, annotation);
        context.enter(modeSelect(context, difference.extantIDs()));
    };


    operation.available = function() {
        return vertices.length === 1;
    };


    operation.disabled = function() {
        var reason;
        if (_.some(selectedIDs, context.hasHiddenConnections)) {
            reason = 'connected_to_hidden';
        }
        return action.disabled(context.graph()) || reason;
    };


    operation.tooltip = function() {
        var disable = operation.disabled();
        if (disable) {
            return t('operations.split.' + disable);
        }

        var ways = action.ways(context.graph());
        if (ways.length === 1) {
            return t('operations.split.description.' + context.geometry(ways[0].id));
        } else {
            return t('operations.split.description.multiple');
        }
    };


    operation.id = 'split';
    operation.keys = [t('operations.split.key')];
    operation.title = t('operations.split.title');


    return operation;
}
