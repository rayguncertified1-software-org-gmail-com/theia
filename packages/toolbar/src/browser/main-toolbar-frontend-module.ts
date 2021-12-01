/********************************************************************************
 * Copyright (C) 2022 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import '../../src/browser/style/toolbar-shell-style.css';
import '../../src/browser/style/easy-search-style.css';
import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { bindToolbarApplicationShell } from './application-shell-with-toolbar-override';
import { bindMainToolbar } from './main-toolbar-command-contribution';

export default new ContainerModule((
    bind: interfaces.Bind,
    unbind: interfaces.Unbind,
    _isBound: interfaces.IsBound,
    rebind: interfaces.Rebind,
) => {
    bindToolbarApplicationShell(bind, rebind, unbind);
    bindMainToolbar(bind);
});
