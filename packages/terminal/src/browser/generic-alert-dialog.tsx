// *****************************************************************************
// Copyright (C) 2022 YourCompany and others.
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

import * as React from '@theia/core/shared/react';
import { ReactDialog } from '@theia/core/lib/browser/dialogs/react-dialog';
import { injectable, inject, interfaces } from '@theia/core/shared/inversify';
import { codicon, DialogProps } from '@theia/core/lib/browser';

export const GenericAlertDialogSettings = Symbol('GenericAlertDialog');
export interface GenericAlertDialogSettings {
    message: string;
    title: string;
    className: string;
    type: 'error' | 'warning' | 'info'
    primaryButtons: Set<string>,
    exitButton: string,
}

export const GenericAlertDialogFactory = Symbol('GenericAlertDialogFactory');
export interface GenericAlertDialogFactory {
    (settings: GenericAlertDialogSettings): GenericAlertDialog;
}

@injectable()
export class GenericAlertDialog extends ReactDialog<string | 'close'> {
    protected selectedValue: string | 'close' = '';

    constructor(
        @inject(DialogProps) protected override readonly props: DialogProps,
        @inject(GenericAlertDialogSettings) protected readonly dialogSettings: GenericAlertDialogSettings,
    ) {
        super(props);
        this.addClass('theia-alert-dialog');
        this.addClass(dialogSettings.type);
        this.addClass(dialogSettings.className);
    }

    protected render(): React.ReactNode {
        const { className, type, message, primaryButtons, exitButton } = this.dialogSettings;
        return (
            <div className={`theia-alert-dialog-content-wrapper ${type} ${className}`}>
                <div className='theia-alert-dialog-message-wrapper'>
                    <div className={`${codicon(type)} alert-icon`} />
                    <div className='message-container'>
                        <div className='message'>{message}</div>
                    </div>
                </div>
                <div className={`theia-alert-dialog-buttons-wrapper ${className}`}>
                    {
                        Array.from(primaryButtons).map(button => (
                            <button
                                className='theia-button'
                                onClick={this.handleButton}
                                type='button'
                                key={button}
                                data-id={button}
                            >
                                {button}
                            </button>
                        ))}
                    <button
                        className='theia-button secondary'
                        onClick={this.handleButton}
                        type='button'
                        key='close'
                        data-id='close'
                    >
                        {exitButton}
                    </button>
                </div>
            </div>
        );
    }

    protected handleButton = (e: React.MouseEvent<HTMLButtonElement>): void => this.doHandleButton(e);
    protected doHandleButton(e: React.MouseEvent<HTMLButtonElement>): void {
        const buttonText = e.currentTarget.getAttribute('data-id');
        if (buttonText) {
            this.selectedValue = buttonText;
        }
        this.accept();
    }

    get value(): string | 'close' {
        return this.selectedValue;
    }
}

export const bindGenericErrorDialogFactory = (bind: interfaces.Bind): void => {
    bind(GenericAlertDialogFactory)
        .toFactory(({ container }) => (settings: GenericAlertDialogSettings): GenericAlertDialog => {
            const child = container.createChild();
            child.bind(DialogProps).toConstantValue({
                title: settings.title,
                wordWrap: 'break-word',
            });
            child.bind(GenericAlertDialogSettings).toConstantValue(settings);
            child.bind(GenericAlertDialog).toSelf().inSingletonScope();
            return child.get(GenericAlertDialog);
        });
};
