// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************
import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { ReactWidget } from '@theia/core/lib/browser';
import { Terminal } from 'xterm';

export const TERMINAL_LABEL_WIDGET_FACTORY_ID = 'terminal-label';
export const TerminalLabelWidgetFactory = Symbol('TerminalLabelWidgetFactory');
export type TerminalLabelWidgetFactory = (terminal: Terminal) => TerminalLabelWidget;

@injectable()
export class TerminalLabelWidget extends ReactWidget {
    @inject(Terminal) protected terminal: Terminal;

    @postConstruct()
    protected init(): void {
        this.node.classList.add('theia-terminal-label-widget');
    }
    render(): React.ReactNode {
        return (
            <div>
                I Am the terminal title
            </div>
        );
    }
}

export function createTerminalLabelWidgetFactory(container: interfaces.Container): TerminalLabelWidgetFactory {
    container.bind(TerminalLabelWidget).toSelf().inSingletonScope();

    return (terminal: Terminal) => {
        container.bind(Terminal).toConstantValue(terminal);
        return container.get(TerminalLabelWidget);
    };
}
