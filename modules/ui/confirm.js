import { t } from '../util/locale';
import { uiModal } from './modal';


export function uiConfirm(selection) {
    var modalSelection = uiModal(selection);

    modalSelection.select('.modal')
        .classed('modal-alert', true);

    var section = modalSelection.select('.content');

    section.append('div')
        .attr('class', 'modal-section header');

    section.append('div')
        .attr('class', 'modal-section message-text');

    var buttons = section.append('div')
        .attr('class', 'modal-section buttons cf');


    modalSelection.okButton = function() {
        buttons
            .append('button')
            .attr('class', 'action col4')
            .on('click.confirm', function() {
                modalSelection.remove();
            })
            .text(t('confirm.okay'));

        return modalSelection;
    };


    return modalSelection;
}
